import React, { forwardRef } from 'react';
import {
  getExpenseVisualCategory,
  resolveExpenseVisual,
  type ExpenseVisualId,
} from '../lib/expenseVisuals';

export type ExpenseIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ExpenseIconProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children' | 'title'> {
  /** Used for deterministic inference when visualId is missing or invalid. */
  title?: string;
  /** Optional presentation-only override. No backend field is required. */
  visualId?: ExpenseVisualId | string | null;
  size?: ExpenseIconSize;
  /** Add a label only when this icon is meaningful rather than decorative. */
  accessibilityLabel?: string;
}

const sizeStyles: Record<ExpenseIconSize, { container: string; icon: number }> = {
  xs: { container: 'h-7 w-7 rounded-lg', icon: 15 },
  sm: { container: 'h-9 w-9 rounded-xl', icon: 19 },
  md: { container: 'h-11 w-11 rounded-[14px]', icon: 23 },
  lg: { container: 'h-13 w-13 rounded-2xl', icon: 27 },
  xl: { container: 'h-16 w-16 rounded-[20px]', icon: 32 },
};

export const ExpenseIcon = forwardRef<HTMLSpanElement, ExpenseIconProps>(
  function ExpenseIcon(
    {
      title = '',
      visualId,
      size = 'md',
      accessibilityLabel,
      className = '',
      style,
      ...spanProps
    },
    ref,
  ) {
    const preset = resolveExpenseVisual(title, visualId);
    const category = getExpenseVisualCategory(preset.categoryId);
    const IconComponent = preset.icon;
    const sizeStyle = sizeStyles[size];

    return (
      <span
        {...spanProps}
        ref={ref}
        role={accessibilityLabel ? 'img' : undefined}
        aria-label={accessibilityLabel}
        aria-hidden={accessibilityLabel ? undefined : true}
        data-expense-visual-id={preset.id}
        data-expense-category={preset.categoryId}
        className={`inline-flex shrink-0 items-center justify-center border ${sizeStyle.container} ${className}`}
        style={{
          backgroundColor: category.palette.surface,
          borderColor: category.palette.border,
          color: category.palette.foreground,
          ...style,
        }}
      >
        <IconComponent
          aria-hidden="true"
          size={sizeStyle.icon}
          weight="duotone"
        />
      </span>
    );
  },
);
