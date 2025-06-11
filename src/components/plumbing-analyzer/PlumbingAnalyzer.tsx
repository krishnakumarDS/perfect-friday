// import React, { useEffect, useState } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { Message } from "../../types/plumbing-types";
// import classNames from "classnames";
import { ServerContent, LiveConfig } from "../../multimodal-live-types";
import type { Part } from "@google/generative-ai";
import "./plumbing-analyzer.scss";
import { useEffect, useState } from "react";

export function JarvisAssistant() {
  const { client, connected, connect } = useLiveAPIContext();
  const [messages, setMessages] = useState<Message[]>([]);

  // Handle connection and welcome message
  useEffect(() => {
    if (connected) {
      const welcomeMessage: Message = {
        type: "ai",
        content: "Hello, sir. I'm FRIDAY – your personal AI assistant. Voice-ready, visually enhanced, and fully operational. What would you like me to handle first today?"
      };
      setMessages([welcomeMessage]);
    }
  }, [connected]);

  // Handle AI responses
  useEffect(() => {
    const onContent = (content: ServerContent) => {
      if ("modelTurn" in content && content.modelTurn?.parts) {
        const textPart = content.modelTurn.parts.find(
          (p: Part) => "text" in p && typeof p.text === "string"
        );
        if (textPart && "text" in textPart && textPart.text) {
          const aiMessage: Message = {
            type: "ai",
            content: textPart.text,
          };
          setMessages((prev) => [...prev, aiMessage]);
        }
      }
    };

    client.on("content", onContent);
    return () => {
      client.off("content", onContent);
    };
  }, [client]);

  return (
    <div className="plumbing-analyzer">
      <div className="messages-container">
        {messages.map((message: Message, index: number) => (
          <div key={index} className={`message ${message.type}`}>
            <div className="message-content">
              {message.type === "ai" && <div className="avatar">🤖</div>}
              <div className="text">{message.content}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
