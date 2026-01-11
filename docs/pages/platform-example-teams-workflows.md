---
title: "Connect Agent to MS Teams via Workflows"
category: "Examples"
order: 10
description: "Connect Microsoft Teams to Archestra prompts via Power Automate Workflows"
lastUpdated: "2025-01-08"
---

<!--
Check ../docs_writer_prompt.md before changing this file.

This document is human-built, shouldn't be updated with AI. Don't change anything here.

Exception:
- Screenshot
-->

This guide shows how to connect your Archestra agent to MS Teams using Power Automate Workflows. Unlike the [Azure Bot approach](/docs/platform-example-teams-a2a), this method requires no code deployment and can be set up entirely through the Teams interface.

## Prerequisites

- Microsoft 365 license with Power Automate access (E3, E5, or standalone Power Automate license)
- Archestra instance with a configured prompt

**Note**: If you see "NoEntitlementsFound" error when accessing Workflows, your tenant doesn't have Power Platform licensing. Options:
- Ask your IT admin about Power Automate licensing
- Use the [Azure Bot approach](/docs/platform-example-teams-a2a) instead (no Power Platform license required)
- For testing, use a [Microsoft 365 Developer tenant](https://developer.microsoft.com/microsoft-365/dev-program) which includes Power Automate

## Get A2A Credentials from Archestra

1. Open Archestra and go to **Chats**
2. Find your prompt and click the connect icon (plug icon)
3. Copy the **A2A Endpoint URL** and **Authentication Token**

You'll need these for the HTTP action in your workflow.

![A2A Connect Dialog](/docs/automated_screenshots/platform-example-teams-a2a_connect-dialog.png)

## Create the Workflow

1. In Microsoft Teams, click the **...** menu next to any channel
2. Select **Workflows** > **Create a workflow**
3. Search for **"When a keyword is mentioned"** template
4. Click **Set up** and configure the trigger:
   - Enter the keyword that will trigger your agent (e.g., `@archestra` or `ask-ai`)
   - Select the channel to monitor

## Filter Out Bot Messages

To prevent the workflow from triggering on its own replies (or other bots):

1. After the trigger, add a **Condition** action (Control)
2. Configure the condition to check if message is from a bot:
   - Click in the left field, then switch to **Expression** tab
   - Enter: `triggerBody()?['entity']?['teamsFlowRunContext']?['messagePayload']?['from']?['application']`
   - Condition: **is equal to**
   - Right side: leave empty (or type `null`)
3. Put all your remaining actions in the **If yes** branch (message is from a user)
4. Leave **If no** branch empty (message is from a bot, do nothing)

## Add HTTP Action

After the condition (in the "If yes" branch), add an action to call your Archestra A2A endpoint:

1. Click **+ Add an action**
2. Search for **HTTP** and select **HTTP - Premium**
3. Configure the action:

| Field | Value |
|-------|-------|
| Method | `POST` |
| URI | Your A2A Endpoint URL |
| Headers | `Authorization`: `Bearer YOUR_A2A_TOKEN`<br>`Content-Type`: `application/json` |
| Body | See below |

**Request Body:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "message/send",
  "params": {
    "message": {
      "parts": [
        {
          "kind": "text",
          "text": "@{triggerBody()?['entity']?['plainTextMessage']}"
        }
      ]
    }
  }
}
```

The `plainTextMessage` expression extracts the user's message from the Teams trigger.

## Include Thread Context

To send the full thread history (not just the triggering message):

1. After the trigger, add **Get message details** (Microsoft Teams)
   - Message ID: `@{triggerBody()?['entity']?['teamsFlowRunContext']?['messagePayload']?['replyToId']}`
   - This gets the parent message if triggered from a reply

2. Add **Get replies to a message** (Microsoft Teams)
   - Message ID: same as above
   - This returns all replies in the thread

3. Add **Compose** action to combine the context. Use the dynamic content picker (lightning bolt icon) to select outputs from previous steps instead of typing expressions manually.

4. Update your HTTP action body to reference the Compose output using dynamic content.

**Important**: Action names in expressions must match exactly. Power Automate auto-generates names like `Get_message_details` or `Get_replies_to_a_message` based on the action title. If you see `InvalidTemplate` errors:
- Click on each action to see its actual name in the URL or settings
- Use the dynamic content picker instead of typing expressions manually
- Ensure all referenced actions exist and are positioned before the action using them

**Note**: Thread fetching only works for replies. If the keyword is mentioned in a new (non-reply) message, `replyToId` will be empty.

## Post Response to Teams

Add a final action to reply in the same thread:

1. Click **+ Add an action**
2. Search for **Reply with a message in a channel** (Microsoft Teams)
3. Configure:
   - **Post as**: Flow bot
   - **Team**: Use dynamic content → **Team ID** from trigger
   - **Channel**: Use dynamic content → **Channel ID** from trigger
   - **Message ID**: Use dynamic content → **Reply to message ID** from trigger (for replies) or **Message ID** (for top-level messages)
   - **Message**: Use dynamic content to select the HTTP response body

**Important**: Select values from the **"When keywords are mentioned" trigger**, not from "Get replies to a message". If you select from an array output (like replies), Power Automate will wrap your action in an "Apply to each" loop. The trigger provides single values that won't cause looping.

## Alternative: Adaptive Card Trigger

For a better UX, use an Adaptive Card that presents a text input form:

1. Use the **"When someone responds to an adaptive card"** trigger
2. Design a card with a text input field for the user's question
3. The HTTP action body becomes:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "message/send",
  "params": {
    "message": {
      "parts": [
        {
          "kind": "text",
          "text": "@{triggerBody()?['data']?['userQuestion']}"
        }
      ]
    }
  }
}
```

Where `userQuestion` matches your Adaptive Card input ID.

## Limitations

- **No thread context**: Unlike the Azure Bot approach, workflows don't have access to full thread history
- **Premium connector**: The HTTP action requires a Power Automate Premium license
- **Rate limits**: Power Automate has [execution limits](https://learn.microsoft.com/en-us/power-automate/limits-and-config) depending on your license
- **Response time**: Workflow execution adds latency compared to direct bot integration

## Troubleshooting

**Workflows app shows blank screen or endless loading in Teams**

The Teams Workflows app often fails silently. To see the actual error:

1. Open [powerautomate.com](https://powerautomate.com) directly in your browser
2. Look for an error like: `Request to Azure Resource Manager failed with error: '{"error":{"code":"NoEntitlementsFound","message":"The tenant '...' does not have an entitlement to use PowerApps."}}'`
3. Follow the relevant fix below based on the error

**"NoEntitlementsFound" or "tenant does not have an entitlement to use PowerApps"**

Your Microsoft 365 tenant doesn't have Power Automate licensing. To fix:

1. Go to [Microsoft 365 Admin Center](https://admin.cloud.microsoft/#/catalog) > **Billing** > **Purchase services**
2. Search for "Power Automate"
3. Add [**Power Automate Premium**](https://admin.cloud.microsoft/#/catalog/m/offer-details/power-automate-premium/CFQ7TTC0LSGZ) (free trial available) - required for HTTP connector
4. Assign the license to your user account
5. Wait a few minutes for the license to propagate, then retry

**Note**: The basic "Power Automate per user plan" is not sufficient - you need **Power Automate Premium** to use HTTP webhooks.

Alternatively, use the [Azure Bot approach](/docs/platform-example-teams-a2a) which doesn't require Power Platform licensing.

## When to Use Each Approach

| Approach | Best For |
|----------|----------|
| **Workflows** (this guide) | Quick setup, no-code teams, simple Q&A use cases |
| **[Azure Bot](/docs/platform-example-teams-a2a)** | Thread history access, lower latency, complex interactions |
