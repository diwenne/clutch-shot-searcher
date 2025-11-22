'use client';

import { useState } from 'react';
import { XMarkIcon, ClipboardIcon, CheckIcon, ShareIcon } from '@heroicons/react/24/outline';

interface ShareDialogProps {
  shareURL: string;
  onClose: () => void;
}

export default function ShareDialog({ shareURL, onClose }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareURL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback for browsers that don't support clipboard API
      try {
        const textArea = document.createElement('textarea');
        textArea.value = shareURL;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackError) {
        alert('Failed to copy to clipboard. Please copy manually.');
      }
    }
  };

  const urlLength = shareURL.length;
  const isLongURL = urlLength > 1500;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <ShareIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
              Share Analysis
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Share this link with coaches or students to view your filtered shots, sequences, and notes.
          They'll see the exact same analysis state you're currently viewing.
        </p>

        {/* Warning for long URLs */}
        {isLongURL && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ This share link is quite long ({urlLength} characters). Some messaging apps may truncate it.
              Consider using fewer filters or sequences for a shorter link.
            </p>
          </div>
        )}

        {/* URL Display */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Shareable Link
          </label>
          <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
            <code className="text-sm text-zinc-800 dark:text-zinc-200 break-all block max-h-32 overflow-y-auto">
              {shareURL}
            </code>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            disabled={copied}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
              copied
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {copied ? (
              <>
                <CheckIcon className="w-5 h-5" />
                Copied to Clipboard!
              </>
            ) : (
              <>
                <ClipboardIcon className="w-5 h-5" />
                Copy Link
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>

        {/* URL Stats & Info */}
        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Link length: {urlLength} characters</span>
            <span className={urlLength > 2000 ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
              {urlLength > 2000 ? '⚠️ May be too long for some browsers' : '✓ Safe for all browsers'}
            </span>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            <strong>💡 Tip:</strong> Recipients will see your current filters, sequences, and notes.
            Any changes you make after sharing won't affect the shared link.
          </p>
        </div>
      </div>
    </div>
  );
}
