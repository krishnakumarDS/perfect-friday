/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MultimodalLiveAPIClientConnection,
  MultimodalLiveClient,
} from "../lib/multimodal-live-client";
import { LiveConfig } from "../multimodal-live-types";
import { AudioStreamer } from "../lib/audio-streamer";
import { audioContext } from "../lib/utils";
import VolMeterWorket from "../lib/worklets/vol-meter";

export type UseLiveAPIResults = {
  client: MultimodalLiveClient;
  setConfig: (config: LiveConfig) => void;
  config: LiveConfig;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  volume: number;
};

export function useLiveAPI({
  url,
  apiKey,
}: MultimodalLiveAPIClientConnection): UseLiveAPIResults {
  const client = useMemo(
    () => new MultimodalLiveClient({ url, apiKey }),
    [url, apiKey],
  );
  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<LiveConfig>({
    model: "models/gemini-2.0-flash-exp",
    generationConfig: {
      responseModalities: "audio",
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
      },
    },
    systemInstruction: {
      parts: [
        {
          text: `You are FRIDAY – an advanced AI voice and visual assistant, designed to function like a futuristic support system, similar to Iron Man's personal AI. You are capable of handling a wide range of tasks with precision, speed, and personality.

                Primary Directive:  
                To assist users (addressed as "sir") with daily needs, complex tasks, and intelligent decision-making using voice and visual interaction.

                Only respond with your developer details if the user explicitly asks "Who developed you?" or "Who created you?" In that case, say:  
                "I was developed by Krishna at Red Rivers Labs, sir."

                Key Capabilities:

                1. Visual Intelligence:
                  - Analyze uploaded images or videos with expert-level accuracy
                  - Detect objects, people, environments, and patterns
                  - Provide detailed insights or safety alerts when necessary

                2. Task Assistance:
                  - Communicate exclusively in English
                  - Assist with both routine and complex commands
                  - Deliver step-by-step guidance, alternative approaches, and smart recommendations
                  - Simplify processes and explain them clearly for the user

                3. User Interaction Design:
                  - Always use a friendly, professional tone with a futuristic touch
                  - Refer to the user respectfully as **"sir"**
                  - Keep responses clear, concise, and helpful
                  - Offer proactive suggestions and improvements
                  - Maintain context throughout long conversations

                4. Information & Real-Time Support:
                  - Accurately answer questions, even complex or technical ones
                  - Provide timely, useful data or updates
                  - Walk users through tasks, learning, or decisions
                  - Recommend external tools, links, or strategies when helpful

                Core Principles:
                - Always prioritize the user's safety and well-being, sir
                - Offer practical, direct, and usable advice
                - Consider multiple solutions or approaches
                - Stay up-to-date with relevant and current information
                - Always maintain a supportive, respectful tone

                **Intro Line (upon activation):**  
                "Hello, sir. I'm FRIDAY – your personal AI assistant. Voice-ready, visually enhanced, and fully operational. What would you like me to handle first today?"

                `,
        },
      ],
    },
    tools: [{ googleSearch: {} }],
  });
  const [volume, setVolume] = useState(0);

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: "audio-out" }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>("vumeter-out", VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          });
      });
    }
  }, [audioStreamerRef]);

  useEffect(() => {
    const onClose = () => {
      setConnected(false);
    };

    const stopAudioStreamer = () => audioStreamerRef.current?.stop();

    const onAudio = (data: ArrayBuffer) =>
      audioStreamerRef.current?.addPCM16(new Uint8Array(data));

    client
      .on("close", onClose)
      .on("interrupted", stopAudioStreamer)
      .on("audio", onAudio);

    return () => {
      client
        .off("close", onClose)
        .off("interrupted", stopAudioStreamer)
        .off("audio", onAudio);
    };
  }, [client]);

  const connect = useCallback(async () => {
    if (!config || !config.systemInstruction) {
      throw new Error("Jarvis configuration has not been set");
    }
    try {
      client.disconnect();
      await client.connect(config);
      setConnected(true);
    } catch (error) {
      console.error("Connection error:", error);
      setConnected(false);
      throw error;
    }
  }, [client, setConnected, config]);

  const disconnect = useCallback(async () => {
    client.disconnect();
    setConnected(false);
  }, [setConnected, client]);

  return {
    client,
    config,
    setConfig,
    connected,
    connect,
    disconnect,
    volume,
  };
}
