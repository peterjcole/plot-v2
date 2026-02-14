'use client';

import * as Toggle from '@radix-ui/react-toggle';

interface IconToggleProps {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}

export default function IconToggle({ pressed, onPressedChange, title, disabled, children }: IconToggleProps) {
  return (
    <Toggle.Root
      pressed={pressed}
      onPressedChange={onPressedChange}
      disabled={disabled}
      title={title}
      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
        disabled
          ? 'opacity-30 cursor-not-allowed'
          : pressed
            ? 'bg-accent text-white'
            : 'text-text-primary hover:bg-surface-muted'
      }`}
    >
      {children}
    </Toggle.Root>
  );
}
