import { describe, expect, test } from "@/test";
import type { OpenAiResponses } from "@/types";
import { openaiResponsesAdapterFactory } from "./openai-responses";

type ResponsesRequest = OpenAiResponses.Types.ResponsesRequest;
type ResponsesResponse = OpenAiResponses.Types.ResponsesResponse;
type OutputItem = ResponsesResponse["output"][number];

function createMockResponse(
  output: OutputItem[],
  usage?: Partial<OpenAiResponses.Types.ResponsesUsage>,
): ResponsesResponse {
  return {
    id: "resp_test",
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    model: "gpt-4o",
    status: "completed",
    output,
    usage: {
      input_tokens: usage?.input_tokens ?? 100,
      output_tokens: usage?.output_tokens ?? 50,
      total_tokens: (usage?.input_tokens ?? 100) + (usage?.output_tokens ?? 50),
    },
  };
}

function createMockRequest(
  input: ResponsesRequest["input"],
  options?: Partial<ResponsesRequest>,
): ResponsesRequest {
  return {
    model: "gpt-4o",
    input,
    ...options,
  };
}

describe("OpenAIResponsesResponseAdapter", () => {
  describe("getToolCalls", () => {
    test("converts function calls to common format", () => {
      const response = createMockResponse([
        {
          type: "function_call",
          id: "fc_123",
          call_id: "call_123",
          name: "test_tool",
          arguments: '{"param1": "value1", "param2": 42}',
          status: "completed",
        },
      ]);

      const adapter =
        openaiResponsesAdapterFactory.createResponseAdapter(response);
      const result = adapter.getToolCalls();

      expect(result).toEqual([
        {
          id: "call_123",
          name: "test_tool",
          arguments: { param1: "value1", param2: 42 },
        },
      ]);
    });

    test("handles invalid JSON in arguments gracefully", () => {
      const response = createMockResponse([
        {
          type: "function_call",
          id: "fc_789",
          call_id: "call_789",
          name: "broken_tool",
          arguments: "invalid json{",
          status: "completed",
        },
      ]);

      const adapter =
        openaiResponsesAdapterFactory.createResponseAdapter(response);
      const result = adapter.getToolCalls();

      expect(result).toEqual([
        {
          id: "call_789",
          name: "broken_tool",
          arguments: {},
        },
      ]);
    });

    test("handles multiple function calls", () => {
      const response = createMockResponse([
        {
          type: "function_call",
          id: "fc_1",
          call_id: "call_1",
          name: "tool_one",
          arguments: '{"param": "value1"}',
          status: "completed",
        },
        {
          type: "function_call",
          id: "fc_2",
          call_id: "call_2",
          name: "tool_two",
          arguments: '{"param": "value2"}',
          status: "completed",
        },
      ]);

      const adapter =
        openaiResponsesAdapterFactory.createResponseAdapter(response);
      const result = adapter.getToolCalls();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "call_1",
        name: "tool_one",
        arguments: { param: "value1" },
      });
      expect(result[1]).toEqual({
        id: "call_2",
        name: "tool_two",
        arguments: { param: "value2" },
      });
    });

    test("handles empty arguments", () => {
      const response = createMockResponse([
        {
          type: "function_call",
          id: "fc_empty",
          call_id: "call_empty",
          name: "empty_tool",
          arguments: "{}",
          status: "completed",
        },
      ]);

      const adapter =
        openaiResponsesAdapterFactory.createResponseAdapter(response);
      const result = adapter.getToolCalls();

      expect(result).toEqual([
        {
          id: "call_empty",
          name: "empty_tool",
          arguments: {},
        },
      ]);
    });

    test("ignores non-function-call output items", () => {
      const response = createMockResponse([
        {
          type: "message",
          id: "msg_1",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "Hello" }],
        },
        {
          type: "function_call",
          id: "fc_1",
          call_id: "call_1",
          name: "test_tool",
          arguments: '{"key": "value"}',
          status: "completed",
        },
      ]);

      const adapter =
        openaiResponsesAdapterFactory.createResponseAdapter(response);
      const result = adapter.getToolCalls();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("test_tool");
    });
  });

  describe("getText", () => {
    test("extracts text content from message output", () => {
      const response = createMockResponse([
        {
          type: "message",
          id: "msg_1",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "Hello, world!" }],
        },
      ]);

      const adapter =
        openaiResponsesAdapterFactory.createResponseAdapter(response);
      expect(adapter.getText()).toBe("Hello, world!");
    });

    test("concatenates multiple text parts", () => {
      const response = createMockResponse([
        {
          type: "message",
          id: "msg_1",
          role: "assistant",
          status: "completed",
          content: [
            { type: "output_text", text: "Hello, " },
            { type: "output_text", text: "world!" },
          ],
        },
      ]);

      const adapter =
        openaiResponsesAdapterFactory.createResponseAdapter(response);
      expect(adapter.getText()).toBe("Hello, world!");
    });

    test("returns empty string when no text content", () => {
      const response = createMockResponse([
        {
          type: "function_call",
          id: "fc_1",
          call_id: "call_1",
          name: "test_tool",
          arguments: "{}",
          status: "completed",
        },
      ]);

      const adapter =
        openaiResponsesAdapterFactory.createResponseAdapter(response);
      expect(adapter.getText()).toBe("");
    });
  });

  describe("getUsage", () => {
    test("extracts usage tokens from response", () => {
      const response = createMockResponse(
        [
          {
            type: "message",
            id: "msg_1",
            role: "assistant",
            status: "completed",
            content: [{ type: "output_text", text: "Test" }],
          },
        ],
        { input_tokens: 150, output_tokens: 75 },
      );

      const adapter =
        openaiResponsesAdapterFactory.createResponseAdapter(response);
      const usage = adapter.getUsage();

      expect(usage).toEqual({
        inputTokens: 150,
        outputTokens: 75,
      });
    });

    test("returns zeros when usage is missing", () => {
      const response: ResponsesResponse = {
        id: "resp_test",
        object: "response",
        created_at: Math.floor(Date.now() / 1000),
        model: "gpt-4o",
        status: "completed",
        output: [],
      };

      const adapter =
        openaiResponsesAdapterFactory.createResponseAdapter(response);
      const usage = adapter.getUsage();

      expect(usage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
      });
    });
  });

  describe("hasToolCalls", () => {
    test("returns true when function calls present", () => {
      const response = createMockResponse([
        {
          type: "function_call",
          id: "fc_1",
          call_id: "call_1",
          name: "test",
          arguments: "{}",
          status: "completed",
        },
      ]);

      const adapter =
        openaiResponsesAdapterFactory.createResponseAdapter(response);
      expect(adapter.hasToolCalls()).toBe(true);
    });

    test("returns false when no function calls", () => {
      const response = createMockResponse([
        {
          type: "message",
          id: "msg_1",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "Hello" }],
        },
      ]);

      const adapter =
        openaiResponsesAdapterFactory.createResponseAdapter(response);
      expect(adapter.hasToolCalls()).toBe(false);
    });
  });

  describe("toRefusalResponse", () => {
    test("creates refusal response with provided message", () => {
      const response = createMockResponse([
        {
          type: "message",
          id: "msg_1",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "Original content" }],
        },
      ]);

      const adapter =
        openaiResponsesAdapterFactory.createResponseAdapter(response);
      const refusal = adapter.toRefusalResponse(
        "Full refusal",
        "Tool call blocked by policy",
      );

      expect(refusal.output).toHaveLength(1);
      expect(refusal.output[0].type).toBe("message");
      const messageOutput = refusal.output[0] as {
        type: "message";
        content: Array<{ type: string; text?: string }>;
      };
      expect(messageOutput.content[0].text).toBe("Tool call blocked by policy");
    });
  });
});

describe("OpenAIResponsesRequestAdapter", () => {
  describe("getModel", () => {
    test("returns original model by default", () => {
      const request = createMockRequest("Hello", { model: "gpt-4o-mini" });

      const adapter =
        openaiResponsesAdapterFactory.createRequestAdapter(request);
      expect(adapter.getModel()).toBe("gpt-4o-mini");
    });

    test("returns modified model after setModel", () => {
      const request = createMockRequest("Hello", { model: "gpt-4o" });

      const adapter =
        openaiResponsesAdapterFactory.createRequestAdapter(request);
      adapter.setModel("gpt-4o-mini");
      expect(adapter.getModel()).toBe("gpt-4o-mini");
    });
  });

  describe("isStreaming", () => {
    test("returns true when stream is true", () => {
      const request = createMockRequest("Hello", { stream: true });

      const adapter =
        openaiResponsesAdapterFactory.createRequestAdapter(request);
      expect(adapter.isStreaming()).toBe(true);
    });

    test("returns false when stream is false", () => {
      const request = createMockRequest("Hello", { stream: false });

      const adapter =
        openaiResponsesAdapterFactory.createRequestAdapter(request);
      expect(adapter.isStreaming()).toBe(false);
    });

    test("returns false when stream is undefined", () => {
      const request = createMockRequest("Hello");

      const adapter =
        openaiResponsesAdapterFactory.createRequestAdapter(request);
      expect(adapter.isStreaming()).toBe(false);
    });
  });

  describe("getTools", () => {
    test("extracts function tools from request", () => {
      const request = createMockRequest("Hello", {
        tools: [
          {
            type: "function",
            name: "get_weather",
            description: "Get weather for a location",
            parameters: {
              type: "object",
              properties: {
                location: { type: "string" },
              },
            },
          },
        ],
      });

      const adapter =
        openaiResponsesAdapterFactory.createRequestAdapter(request);
      const tools = adapter.getTools();

      expect(tools).toEqual([
        {
          name: "get_weather",
          description: "Get weather for a location",
          inputSchema: {
            type: "object",
            properties: {
              location: { type: "string" },
            },
          },
        },
      ]);
    });

    test("ignores non-function tools (web_search, etc.)", () => {
      const request = createMockRequest("Hello", {
        tools: [
          { type: "web_search" },
          {
            type: "function",
            name: "custom_tool",
            parameters: { type: "object" },
          },
        ],
      });

      const adapter =
        openaiResponsesAdapterFactory.createRequestAdapter(request);
      const tools = adapter.getTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("custom_tool");
    });

    test("returns empty array when no tools", () => {
      const request = createMockRequest("Hello");

      const adapter =
        openaiResponsesAdapterFactory.createRequestAdapter(request);
      expect(adapter.getTools()).toEqual([]);
    });
  });

  describe("getMessages", () => {
    test("handles string input", () => {
      const request = createMockRequest("Hello, how are you?");

      const adapter =
        openaiResponsesAdapterFactory.createRequestAdapter(request);
      const messages = adapter.getMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("user");
    });

    test("handles array input with messages", () => {
      const request = createMockRequest([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ]);

      const adapter =
        openaiResponsesAdapterFactory.createRequestAdapter(request);
      const messages = adapter.getMessages();

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("user");
      expect(messages[1].role).toBe("assistant");
    });

    test("handles function_call_output items as tool results", () => {
      const request = createMockRequest([
        { role: "user", content: "Get the weather" },
        {
          type: "function_call_output",
          call_id: "call_123",
          output: '{"temperature": 72, "unit": "fahrenheit"}',
        },
      ]);

      const adapter =
        openaiResponsesAdapterFactory.createRequestAdapter(request);
      const messages = adapter.getMessages();

      expect(messages).toHaveLength(2);
      expect(messages[1].role).toBe("tool");
      expect(messages[1].toolCalls).toEqual([
        {
          id: "call_123",
          name: "unknown",
          content: { temperature: 72, unit: "fahrenheit" },
          isError: false,
        },
      ]);
    });
  });

  describe("getToolResults", () => {
    test("extracts tool results from function_call_output items", () => {
      const request = createMockRequest([
        {
          type: "function_call_output",
          call_id: "call_123",
          output: '{"result": "success"}',
        },
      ]);

      const adapter =
        openaiResponsesAdapterFactory.createRequestAdapter(request);
      const results = adapter.getToolResults();

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: "call_123",
        name: "unknown",
        content: { result: "success" },
        isError: false,
      });
    });

    test("returns empty array for string input", () => {
      const request = createMockRequest("Hello");

      const adapter =
        openaiResponsesAdapterFactory.createRequestAdapter(request);
      expect(adapter.getToolResults()).toEqual([]);
    });
  });

  describe("toProviderRequest", () => {
    test("applies model change to request", () => {
      const request = createMockRequest("Hello", { model: "gpt-4o" });

      const adapter =
        openaiResponsesAdapterFactory.createRequestAdapter(request);
      adapter.setModel("gpt-4o-mini");
      const result = adapter.toProviderRequest();

      expect(result.model).toBe("gpt-4o-mini");
    });

    test("applies tool result updates to request", () => {
      const request = createMockRequest([
        { role: "user", content: "Get the weather" },
        {
          type: "function_call_output",
          call_id: "call_123",
          output: '{"temperature": 72}',
        },
      ]);

      const adapter =
        openaiResponsesAdapterFactory.createRequestAdapter(request);
      adapter.updateToolResult(
        "call_123",
        '{"temperature": 75, "note": "updated"}',
      );
      const result = adapter.toProviderRequest();

      const input = result.input as Array<{
        type?: string;
        call_id?: string;
        output?: string;
      }>;
      const functionOutput = input.find(
        (item) => item.type === "function_call_output",
      );
      expect(functionOutput?.output).toBe(
        '{"temperature": 75, "note": "updated"}',
      );
    });
  });
});

describe("openaiResponsesAdapterFactory", () => {
  describe("extractApiKey", () => {
    test("returns authorization header as-is (Bearer token)", () => {
      const headers = { authorization: "Bearer sk-test-key-123" };
      const apiKey = openaiResponsesAdapterFactory.extractApiKey(headers);
      // Returns full header - OpenAI SDK handles "Bearer " prefix
      expect(apiKey).toBe("Bearer sk-test-key-123");
    });

    test("returns authorization header as-is (non-Bearer)", () => {
      const headers = { authorization: "sk-test-key-123" };
      const apiKey = openaiResponsesAdapterFactory.extractApiKey(headers);
      expect(apiKey).toBe("sk-test-key-123");
    });

    test("returns undefined when no authorization header", () => {
      const headers = {} as unknown as OpenAiResponses.Types.ResponsesHeaders;
      const apiKey = openaiResponsesAdapterFactory.extractApiKey(headers);
      expect(apiKey).toBeUndefined();
    });
  });

  describe("provider info", () => {
    test("has correct provider name", () => {
      expect(openaiResponsesAdapterFactory.provider).toBe("openai-responses");
    });

    test("has correct interaction type", () => {
      expect(openaiResponsesAdapterFactory.interactionType).toBe(
        "openai:responses",
      );
    });
  });
});

describe("OpenAIResponsesStreamAdapter", () => {
  test("initializes with correct default state", () => {
    const adapter = openaiResponsesAdapterFactory.createStreamAdapter();

    expect(adapter.state.responseId).toBe("");
    expect(adapter.state.model).toBe("");
    expect(adapter.state.text).toBe("");
    expect(adapter.state.toolCalls).toEqual([]);
    expect(adapter.state.usage).toBeNull();
  });

  test("processes text delta events", () => {
    const adapter = openaiResponsesAdapterFactory.createStreamAdapter();

    const result = adapter.processChunk({
      type: "response.output_text.delta",
      output_index: 0,
      content_index: 0,
      delta: "Hello",
    });

    expect(adapter.state.text).toBe("Hello");
    expect(result.sseData).toContain("Hello");
    expect(result.isToolCallChunk).toBe(false);
    expect(result.isFinal).toBe(false);
  });

  test("processes function call events", () => {
    const adapter = openaiResponsesAdapterFactory.createStreamAdapter();

    // Add function call
    adapter.processChunk({
      type: "response.output_item.added",
      output_index: 0,
      item: {
        type: "function_call",
        id: "fc_1",
        call_id: "call_1",
        name: "test_tool",
        arguments: "",
        status: "in_progress",
      },
    });

    // Add arguments delta
    const deltaResult = adapter.processChunk({
      type: "response.function_call_arguments.delta",
      output_index: 0,
      call_id: "call_1",
      delta: '{"key": "value"}',
    });

    expect(deltaResult.isToolCallChunk).toBe(true);

    // Complete function call
    adapter.processChunk({
      type: "response.output_item.done",
      output_index: 0,
      item: {
        type: "function_call",
        id: "fc_1",
        call_id: "call_1",
        name: "test_tool",
        arguments: '{"key": "value"}',
        status: "completed",
      },
    });

    expect(adapter.state.toolCalls).toHaveLength(1);
    expect(adapter.state.toolCalls[0]).toEqual({
      id: "call_1",
      name: "test_tool",
      arguments: '{"key": "value"}',
    });
  });

  test("processes response.completed event as final", () => {
    const adapter = openaiResponsesAdapterFactory.createStreamAdapter();

    const result = adapter.processChunk({
      type: "response.completed",
      response: {
        id: "resp_123",
        object: "response",
        created_at: Math.floor(Date.now() / 1000),
        model: "gpt-4o",
        status: "completed",
        output: [],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_tokens: 150,
        },
      },
    });

    expect(result.isFinal).toBe(true);
    expect(adapter.state.usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
    });
  });

  test("generates correct SSE format", () => {
    const adapter = openaiResponsesAdapterFactory.createStreamAdapter();

    const headers = adapter.getSSEHeaders();
    expect(headers["Content-Type"]).toBe("text/event-stream");

    const textDelta = adapter.formatTextDeltaSSE("Hello");
    expect(textDelta).toContain("data:");
    expect(textDelta).toContain("Hello");

    const endSSE = adapter.formatEndSSE();
    expect(endSSE).toContain("[DONE]");
  });

  test("toProviderResponse builds correct response", () => {
    const adapter = openaiResponsesAdapterFactory.createStreamAdapter();

    // Simulate some state
    adapter.processChunk({
      type: "response.created",
      response: {
        id: "resp_123",
        object: "response",
        created_at: Math.floor(Date.now() / 1000),
        model: "gpt-4o",
        status: "in_progress",
        output: [],
      },
    });

    adapter.processChunk({
      type: "response.output_text.delta",
      output_index: 0,
      content_index: 0,
      delta: "Hello world",
    });

    const response = adapter.toProviderResponse();

    expect(response.id).toBe("resp_123");
    expect(response.model).toBe("gpt-4o");
    expect(response.status).toBe("completed");
    expect(response.output).toHaveLength(1);
    expect(response.output[0].type).toBe("message");
  });
});
