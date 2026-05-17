'use client';

import { StockNote } from '@/types';
import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface NotesModalProps {
  ticker: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Partial<StockNote>) => Promise<void>;
}

const TAG_COLORS = {
  BUY: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  SELL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  HOLD: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
};

export function NotesModal({ ticker, isOpen, onClose, onSave }: NotesModalProps) {
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<('BUY' | 'SELL' | 'HOLD')[]>([]);
  const [targetBuyPrice, setTargetBuyPrice] = useState('');
  const [targetSellPrice, setTargetSellPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      const response = await fetch(`/api/notes/${ticker}`);
      if (response.ok) {
        const data = await response.json();
        setNote(data.note || '');
        setTags(data.tags || []);
        setTargetBuyPrice(data.target_buy_price?.toString() || '');
        setTargetSellPrice(data.target_sell_price?.toString() || '');
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  }, [ticker]);

  useEffect(() => {
    // Load existing notes when modal opens
    if (isOpen) {
      fetchNotes();
    }
  }, [isOpen, fetchNotes]);

  const toggleTag = (tag: 'BUY' | 'SELL' | 'HOLD') => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ticker,
        note,
        tags,
        target_buy_price: targetBuyPrice ? parseFloat(targetBuyPrice) : undefined,
        target_sell_price: targetSellPrice ? parseFloat(targetSellPrice) : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Notes for {ticker}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Action Tags
            </label>
            <div className="flex gap-2">
              {(Object.keys(TAG_COLORS) as Array<'BUY' | 'SELL' | 'HOLD'>).map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    tags.includes(tag)
                      ? TAG_COLORS[tag]
                      : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Target Buy Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Buy Price
            </label>
            <input
              type="number"
              value={targetBuyPrice}
              onChange={(e) => setTargetBuyPrice(e.target.value)}
              placeholder="$0.00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              step="0.01"
            />
          </div>

          {/* Target Sell Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Sell Price
            </label>
            <input
              type="number"
              value={targetSellPrice}
              onChange={(e) => setTargetSellPrice(e.target.value)}
              placeholder="$0.00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              step="0.01"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add your notes here..."
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        <div className="flex gap-3 border-t border-gray-200 p-6 dark:border-gray-800">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
