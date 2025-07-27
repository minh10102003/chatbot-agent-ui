import { ToolCall } from "@langchain/core/messages/tool";
import { unknownToPrettyDate } from "../utils";

export function ToolCallTable({ toolCall }: { toolCall: ToolCall }) {
  return (
    <div className="max-w-full min-w-[300px] overflow-hidden rounded-lg border border-border bg-muted">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th
              className="bg-secondary px-2 py-0 text-left text-sm text-secondary-foreground"
              colSpan={2}
            >
              {toolCall.name}
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(toolCall.args).map(([key, value]) => {
            let valueStr = "";
            if (["string", "number"].includes(typeof value)) {
              valueStr = value.toString();
            }

            const date = unknownToPrettyDate(value);
            if (date) {
              valueStr = date;
            }

            try {
              valueStr = valueStr || JSON.stringify(value, null);
            } catch (_) {
              valueStr = "";
            }

            return (
              <tr
                key={key}
                className="border-t border-border"
              >
                <td className="w-1/3 px-2 py-1 text-xs font-medium text-muted-foreground">{key}</td>
                <td className="px-2 py-1 font-mono text-xs text-card-foreground">{valueStr}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
