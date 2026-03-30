'use client';

import { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Send, Wine, Sparkles } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const STARTER_PROMPTS = [
  "I want a chill 2-player game for date night",
  "What's a good gateway game for non-gamers?",
  "I loved Wingspan, what else would I like?",
  "Best party games for 6+ people?",
  "Heavy strategy game under 2 hours",
  "Something like Zelda but a board game",
];

export default function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: ChatMessage = { role: 'user', content };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.message ?? data.error ?? 'Something went wrong.',
      };
      setMessages([...updatedMessages, assistantMsg]);
    } catch {
      setMessages([...updatedMessages, { role: 'assistant', content: 'Connection error. Try again.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <Container maxWidth="md" sx={{ height: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column', py: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #5B4FDB, #FF6D3F)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Wine size={20} color="#FFFFFF" />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            Board Game Sommelier
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Your personal game recommendation expert
          </Typography>
        </Box>
      </Box>

      {/* Messages area */}
      <Paper
        ref={scrollRef}
        variant="outlined"
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          mb: 2,
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {messages.length === 0 && !loading && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, py: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Sparkles size={32} color="#FFB020" />
              <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
                What are you in the mood for?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Describe what you want and I'll find the perfect game.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', maxWidth: 500 }}>
              {STARTER_PROMPTS.map((prompt) => (
                <Chip
                  key={prompt}
                  label={prompt}
                  variant="outlined"
                  clickable
                  onClick={() => sendMessage(prompt)}
                  sx={{
                    borderRadius: 2,
                    '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {messages.map((msg, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <Box
              sx={{
                maxWidth: '85%',
                px: 2,
                py: 1.5,
                borderRadius: 2.5,
                bgcolor: msg.role === 'user' ? 'primary.main' : 'action.hover',
                color: msg.role === 'user' ? '#FFFFFF' : 'text.primary',
                '& p': { m: 0, mb: 0.5, lineHeight: 1.6 },
                '& strong': { fontWeight: 700 },
                whiteSpace: 'pre-wrap',
                fontSize: '0.9rem',
                lineHeight: 1.6,
              }}
            >
              {msg.content}
            </Box>
          </Box>
        ))}

        {loading && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Thinking...
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Input area */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          placeholder="Describe what you're looking for..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          multiline
          maxRows={3}
          sx={{
            '& .MuiOutlinedInput-root': { borderRadius: 3 },
          }}
        />
        <IconButton
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          sx={{
            bgcolor: 'primary.main',
            color: '#FFFFFF',
            borderRadius: 2.5,
            width: 42,
            height: 42,
            '&:hover': { bgcolor: 'primary.dark' },
            '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
          }}
        >
          <Send size={18} />
        </IconButton>
      </Box>
    </Container>
  );
}
