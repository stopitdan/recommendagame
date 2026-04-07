'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { UserPlus } from 'lucide-react';
import { getCachedUser } from '@/lib/supabase/client';
import { getRecommendCount } from '@/lib/guest';

/**
 * Soft banner encouraging login after a few free searches.
 * Not blocking, just informational. Shows on results page.
 */
export default function LoginPromptBanner() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    async function check() {
      const user = await getCachedUser();
      if (user) return; // Already logged in

      const count = getRecommendCount();
      if (count >= 3) setShow(true); // Show after 3 searches
    }
    check();
  }, []);

  if (!show) return null;

  return (
    <Alert
      severity="info"
      icon={<UserPlus size={20} />}
      action={
        <Button
          color="inherit"
          size="small"
          onClick={() => router.push('/signup')}
          sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap', borderRadius: "100px" }}
        >
          Sign Up Free
        </Button>
      }
      sx={{ mb: 2, borderRadius: 2, display: 'flex', alignItems: 'center' }}
    >
      Create a free account to save favorites, sync your BoardGameGeek/Steam collections, and get recommendations that learn your taste.
    </Alert>
  );
}
