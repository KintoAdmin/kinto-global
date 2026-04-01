// @ts-nocheck
'use client';

type Props = {
  value?: number;
  onChange?: (value: number) => void;
};

export function ScoreButtonGroup({ value, onChange }: Props) {
  return (
    <div className="score-row">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          className={`score-btn score-${score}${value === score ? ' active' : ''}`}
          onClick={() => onChange?.(score)}
          aria-pressed={value === score}
        >
          {score}
        </button>
      ))}
    </div>
  );
}
