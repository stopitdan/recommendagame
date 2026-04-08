"use client";

/**
 * Hero search input with typewriter placeholder and speech-to-text.
 *
 * IMPORTANT: This component must be loaded with `dynamic({ ssr: false })`
 * because react-speech-recognition sets browser support state at module
 * load time, which differs between server (false) and client (true),
 * causing hydration mismatches.
 */

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { useTheme, alpha } from "@mui/material/styles";
import { motion } from "motion/react";
import { ArrowUp, Mic } from "lucide-react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";

// ─── Typewriter placeholder ─────────────────────────────────

const PLACEHOLDER_EXAMPLES = [
  "a cozy game for date night",
  "something like Catan but faster",
  "Resident Evil board game",
  "roguelike deck builder for 2",
  "party game for 6 people",
  "a brain-burner with no luck",
  "Star Wars",
  "something my kids would love",
];

const TYPE_SPEED = 45;
const DELETE_SPEED = 25;
const PAUSE_AFTER = 2000;
const PAUSE_BETWEEN = 400;

function useTypewriter(examples: string[]) {
  const [displayed, setDisplayed] = useState("");
  const [exampleIdx, setExampleIdx] = useState(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isActive) return;

    const current = examples[exampleIdx];
    let charIdx = 0;
    let phase: "typing" | "pausing" | "deleting" | "waiting" = "typing";
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      if (phase === "typing") {
        charIdx++;
        setDisplayed(current.slice(0, charIdx));
        if (charIdx >= current.length) {
          phase = "pausing";
          timer = setTimeout(tick, PAUSE_AFTER);
        } else {
          timer = setTimeout(tick, TYPE_SPEED);
        }
      } else if (phase === "pausing") {
        phase = "deleting";
        timer = setTimeout(tick, DELETE_SPEED);
      } else if (phase === "deleting") {
        charIdx--;
        setDisplayed(current.slice(0, charIdx));
        if (charIdx <= 0) {
          phase = "waiting";
          timer = setTimeout(tick, PAUSE_BETWEEN);
        } else {
          timer = setTimeout(tick, DELETE_SPEED);
        }
      } else {
        setExampleIdx((i) => (i + 1) % examples.length);
      }
    }

    timer = setTimeout(tick, TYPE_SPEED);
    return () => clearTimeout(timer);
  }, [exampleIdx, examples, isActive]);

  return { displayed, setIsActive };
}

// ─── Main component ─────────────────────────────────────────

const SPEECH_IDLE_MS = 1800;

export default function HeroSearch() {
  const router = useRouter();
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [usedSpeech, setUsedSpeech] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speechIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { displayed, setIsActive } = useTypewriter(PLACEHOLDER_EXAMPLES);

  const {
    transcript,
    listening,
    browserSupportsSpeechRecognition,
    resetTranscript,
  } = useSpeechRecognition();

  // Sync speech transcript into the query field live
  useEffect(() => {
    if (listening && transcript) {
      setQuery(transcript);
    }
  }, [transcript, listening]);

  // Auto-stop after silence
  useEffect(() => {
    if (!listening || !transcript) return;
    if (speechIdleTimer.current) clearTimeout(speechIdleTimer.current);
    speechIdleTimer.current = setTimeout(() => {
      SpeechRecognition.stopListening();
    }, SPEECH_IDLE_MS);
    return () => {
      if (speechIdleTimer.current) clearTimeout(speechIdleTimer.current);
    };
  }, [transcript, listening]);

  // Auto-submit after speech ends with text
  const prevListening = useRef(false);
  useEffect(() => {
    if (prevListening.current && !listening && usedSpeech && query.trim()) {
      const timer = setTimeout(() => {
        const params = new URLSearchParams();
        params.set("freeText", query.trim());
        router.push(`/results?${params.toString()}`);
      }, 600);
      prevListening.current = listening;
      return () => clearTimeout(timer);
    }
    prevListening.current = listening;
  }, [listening, query, router, usedSpeech]);

  const hasText = query.trim().length > 0;
  const showTypewriter = !hasText && !focused && !listening;

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (listening) SpeechRecognition.stopListening();
    const params = new URLSearchParams();
    params.set("freeText", trimmed);
    router.push(`/results?${params.toString()}`);
  };

  const handleMicClick = async () => {
    console.log("[HeroSearch] Mic clicked. listening:", listening, "browserSupport:", browserSupportsSpeechRecognition);
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      // Some browsers need an explicit getUserMedia call to trigger the permission prompt
      // before SpeechRecognition.start() will work. Chrome's SpeechRecognition.start()
      // normally handles this, but in some environments it silently fails.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Got permission -- clean up the temporary stream
        stream.getTracks().forEach((track) => track.stop());
        console.log("[HeroSearch] Mic permission granted");
      } catch (err) {
        console.error("[HeroSearch] Mic permission denied:", err);
        return; // Can't proceed without mic access
      }

      resetTranscript();
      setQuery("");
      setUsedSpeech(true);
      setFocused(true);
      setIsActive(false);
      try {
        await SpeechRecognition.startListening({
          continuous: true,
          language: "en-US",
        });
        console.log("[HeroSearch] SpeechRecognition started");
      } catch (err) {
        console.error("[HeroSearch] SpeechRecognition.startListening failed:", err);
      }
    }
  };

  return (
    <Box
      component="form"
      onSubmit={(e: React.FormEvent) => { e.preventDefault(); handleSubmit(); }}
      sx={{ width: "100%", position: "relative" }}
    >
      <Box
        sx={{
          position: "relative",
          bgcolor: alpha(theme.palette.background.paper, 0.6),
          backdropFilter: "blur(16px)",
          borderRadius: "16px",
          border: `1px solid ${alpha(theme.palette.text.secondary, focused || listening ? 0.4 : 0.25)}`,
          boxShadow: focused || listening
            ? `0 0 0 1px ${alpha(theme.palette.text.secondary, 0.15)}`
            : `0 1px 3px ${alpha(theme.palette.common.black, 0.08)}`,
          transition: "border-color 200ms ease, box-shadow 200ms ease",
          "&:hover": {
            borderColor: alpha(theme.palette.text.secondary, 0.35),
          },
          minHeight: "120px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Textarea */}
        <Box
          component="textarea"
          ref={textareaRef}
          value={query}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setQuery(e.target.value);
            setUsedSpeech(false);
          }}
          onFocus={() => { setFocused(true); setIsActive(false); }}
          onBlur={() => { setFocused(false); if (!query) setIsActive(true); }}
          onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          sx={{
            flex: 1,
            width: "100%",
            maxHeight: "200px",
            resize: "none",
            border: "none",
            outline: "none",
            bgcolor: "transparent",
            color: "text.primary",
            fontSize: { xs: "1rem", md: "1.1rem" },
            lineHeight: 1.6,
            fontFamily: "inherit",
            textAlign: "left",
            p: "16px",
            pb: "4px",
            display: "block",
            "&::placeholder": { color: "transparent" },
          }}
        />

        {/* Bottom action bar */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            px: 1.5,
            py: 1,
            flexShrink: 0,
          }}
        >
          {hasText || listening ? (
            <motion.div
              key="submit"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <IconButton
                type="submit"
                sx={{
                  bgcolor: "secondary.main",
                  color: "secondary.contrastText",
                  width: 36,
                  height: 36,
                  "&:hover": { bgcolor: "secondary.dark" },
                }}
              >
                <ArrowUp size={18} />
              </IconButton>
            </motion.div>
          ) : browserSupportsSpeechRecognition ? (
            <IconButton
              type="button"
              onClick={handleMicClick}
              sx={{
                color: "text.secondary",
                width: 36,
                height: 36,
              }}
            >
              <Mic size={18} />
            </IconButton>
          ) : null}
        </Box>

        {/* Typewriter placeholder */}
        {showTypewriter && (
          <Box
            onClick={() => textareaRef.current?.focus()}
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: "52px",
              p: "16px",
              pointerEvents: "auto",
              cursor: "text",
              textAlign: "left",
            }}
          >
            <Typography
              component="span"
              sx={{
                color: "text.secondary",
                opacity: 0.55,
                fontSize: { xs: "1rem", md: "1.1rem" },
                lineHeight: 1.6,
                fontFamily: "inherit",
                userSelect: "none",
                textAlign: "left",
              }}
            >
              {displayed}
              <Box
                component="span"
                sx={{
                  display: "inline-block",
                  width: "2px",
                  height: "1.15em",
                  bgcolor: "text.secondary",
                  opacity: 0.5,
                  ml: "1px",
                  verticalAlign: "text-bottom",
                  animation: "cursorBlink 1s step-end infinite",
                  "@keyframes cursorBlink": {
                    "0%, 100%": { opacity: 0.5 },
                    "50%": { opacity: 0 },
                  },
                }}
              />
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
