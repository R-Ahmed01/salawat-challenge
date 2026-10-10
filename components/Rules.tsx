import { RULES } from '@/lib/copy';

export function RulesList() {
  return (
    <ol className="rules">
      {RULES.map((rule) => (
        <li key={rule.title}>
          <h3>{rule.title}</h3>
          <p>{rule.body}</p>
        </li>
      ))}
    </ol>
  );
}
