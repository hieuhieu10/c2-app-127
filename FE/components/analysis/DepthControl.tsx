type DepthControlProps = {
  active: string;
  options: readonly string[];
  onChange: (next: string) => void;
};

export default function DepthControl({ active, options, onChange }: DepthControlProps) {
  return (
    <div className="depth-control" aria-label="Proposal depth">
      {options.map((option) => (
        <button
          className={active === option ? "active" : ""}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
