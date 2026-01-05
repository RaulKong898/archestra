/**
 * OpenAI Responses API Type Definitions
 *
 * This namespace contains all Zod schemas and inferred types for the
 * OpenAI Responses API, which is a newer API primitive compared to
 * Chat Completions.
 *
 * @see https://platform.openai.com/docs/api-reference/responses
 */

import type { z } from "zod";
import * as OpenAiResponsesAPI from "./api";
import * as OpenAiResponsesMessages from "./messages";
import * as OpenAiResponsesTools from "./tools";

namespace OpenAiResponses {
  export const API = OpenAiResponsesAPI;
  export const Messages = OpenAiResponsesMessages;
  export const Tools = OpenAiResponsesTools;

  export namespace Types {
    // Headers
    export type ResponsesHeaders = z.infer<
      typeof OpenAiResponsesAPI.ResponsesHeadersSchema
    >;

    // Request/Response
    export type ResponsesRequest = z.infer<
      typeof OpenAiResponsesAPI.ResponsesRequestSchema
    >;
    export type ResponsesResponse = z.infer<
      typeof OpenAiResponsesAPI.ResponsesResponseSchema
    >;
    export type ResponsesUsage = z.infer<
      typeof OpenAiResponsesAPI.ResponsesUsageSchema
    >;

    // Streaming
    export type ResponseStreamEvent = z.infer<
      typeof OpenAiResponsesAPI.ResponseStreamEventSchema
    >;

    // Input/Output
    export type Input = z.infer<typeof OpenAiResponsesMessages.InputSchema>;
    export type InputItem = z.infer<
      typeof OpenAiResponsesMessages.InputItemSchema
    >;
    export type OutputItem = z.infer<
      typeof OpenAiResponsesMessages.OutputItemSchema
    >;
    export type FunctionCallOutput = z.infer<
      typeof OpenAiResponsesMessages.FunctionCallOutputSchema
    >;

    // Tools
    export type Tool = z.infer<typeof OpenAiResponsesTools.ToolSchema>;
    export type ToolChoiceOption = z.infer<
      typeof OpenAiResponsesTools.ToolChoiceOptionSchema
    >;
    export type FunctionTool = z.infer<
      typeof OpenAiResponsesTools.FunctionToolSchema
    >;
  }
}

export default OpenAiResponses;
