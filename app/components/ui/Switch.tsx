'use client';

import * as SwitchPrimitive from '@radix-ui/react-switch';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function Switch({ checked, onCheckedChange, label, disabled }: SwitchProps) {
  const switchElement = (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={`flex items-center w-8 h-[18px] rounded-full transition-colors shrink-0 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-accent' : 'bg-text-secondary/30'}`}
    >
      <SwitchPrimitive.Thumb
        className={`block w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[16px]' : 'translate-x-[2px]'
        }`}
      />
    </SwitchPrimitive.Root>
  );

  if (!label) return switchElement;

  return (
    <label className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors hover:bg-surface-muted sm:gap-2 cursor-pointer whitespace-nowrap">
      {switchElement}
      <span className="text-xs font-medium text-text-primary leading-tight">{label}</span>
    </label>
  );
}
