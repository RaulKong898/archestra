import { archestraApiSdk, type archestraApiTypes } from "@shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useUpdateChatOpsConfigInQuickstart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      body: archestraApiTypes.UpdateChatOpsConfigInQuickstartData["body"],
    ) => {
      const response = await archestraApiSdk.updateChatOpsConfigInQuickstart({
        body,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("MS Teams configuration updated");
      queryClient.invalidateQueries({ queryKey: ["features"] });
      queryClient.invalidateQueries({ queryKey: ["chatops", "status"] });
    },
    onError: (error) => {
      console.error("ChatOps config update error:", error);
      toast.error("Failed to update MS Teams configuration");
    },
  });
}
