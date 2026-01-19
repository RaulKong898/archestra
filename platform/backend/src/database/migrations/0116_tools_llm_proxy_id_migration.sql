-- Migrate tools.agent_id to tools.llm_proxy_id for proxy-sniffed tools
-- These are auto-discovered tools that belong to the LLM Proxy (not MCP catalog tools)
-- The llm_proxies table was created with the same IDs as agents, so we can copy directly

UPDATE tools t
SET llm_proxy_id = t.agent_id
WHERE t.agent_id IS NOT NULL
  AND t.llm_proxy_id IS NULL
  AND t.catalog_id IS NULL;
