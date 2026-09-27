import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

/** Share on the phone; copy to clipboard where sharing isn't available. */
export async function shareText(text: string, title?: string): Promise<'shared' | 'copied' | 'failed'> {
  if (Platform.OS !== 'web') {
    try {
      await Share.share({ message: text, title });
      return 'shared';
    } catch {
      // fall through to clipboard
    }
  }
  try {
    await Clipboard.setStringAsync(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
