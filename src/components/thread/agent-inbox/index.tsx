import { StateView } from "./components/state-view";
import { ThreadActionsView } from "./components/thread-actions-view";
import { useState } from "react";
import { HumanInterrupt } from "@langchain/langgraph/prebuilt";
import { useStreamContext } from "@/providers/Stream";

interface ThreadViewProps {
  interrupt: HumanInterrupt | HumanInterrupt[];
}

export function ThreadView({ interrupt }: ThreadViewProps) {
  const interruptObj = Array.isArray(interrupt) ? interrupt[0] : interrupt;
  const thread = useStreamContext();
  const [showDescription, setShowDescription] = useState(false);
  const [showState, setShowState] = useState(false);
  const showSidePanel = showDescription || showState;

  const handleShowSidePanel = (
    showState: boolean,
    showDescription: boolean,
  ) => {
    if (showState && showDescription) {
      console.error("Cannot show both state and description");
      return;
    }
    if (showState) {
      setShowDescription(false);
      setShowState(true);
    } else if (showDescription) {
      setShowState(false);
      setShowDescription(true);
    } else {
      setShowState(false);
      setShowDescription(false);
    }
  };

  return (
    <div className="w-full min-h-[80vh] flex items-center justify-center bg-background">
      <div
        className="
          bg-card text-card-foreground
          rounded-2xl shadow-lg
          flex flex-col lg:flex-row
          w-full max-w-2xl
          min-h-[330px]  // hoặc tùy chỉnh min-h tùy ý
          p-6
          overflow-hidden
          border border-border
          mx-auto
        "
        // **style này có thể bỏ nếu bạn đã config tailwind cho theme**
      >
        {showSidePanel ? (
          <StateView
            handleShowSidePanel={handleShowSidePanel}
            description={interruptObj.description}
            values={thread.values}
            view={showState ? "state" : "description"}
          />
        ) : (
          <ThreadActionsView
            interrupt={interruptObj}
            handleShowSidePanel={handleShowSidePanel}
            showState={showState}
            showDescription={showDescription}
          />
        )}
      </div>
    </div>
  );
}
