import { useEffect, useRef } from "react";

export type FieldIssue = { fieldId: string; message: string };

export function collectIssues(form: HTMLFormElement): FieldIssue[] {
  return Array.from(form.elements).flatMap((element) => {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) ||
      !element.willValidate ||
      element.validity.valid
    )
      return [];
    if (
      element instanceof HTMLInputElement &&
      element.type === "radio" &&
      !element.checked
    ) {
      const first = form.querySelector<HTMLInputElement>(
        `input[type="radio"][name="${element.name}"]`,
      );
      if (first !== element) return [];
    }
    const label = element.getAttribute('data-error-label') || element.getAttribute('aria-label') || element.name || 'Field';
    return [{ fieldId: element.id, message: `${label}: ${element.validity.valueMissing ? 'This field is required.' : element.validationMessage}` }];
  });
}

export function FormFeedback({
  issues,
  message = "",
}: {
  issues: FieldIssue[];
  message?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (issues.length || message) ref.current?.focus();
  }, [issues, message]);
  if (!issues.length && !message) return null;
  return (
    <div
      className="error form-feedback"
      role="alert"
      tabIndex={-1}
      ref={ref}
      aria-label="There is a problem"
    >
      <h3>Check before continuing</h3>
      {message && <p>{message}</p>}
      {!!issues.length && (
        <ul>
          {issues.map((issue) => (
            <li key={issue.fieldId}>
              <a
                href={"#" + issue.fieldId}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(issue.fieldId)?.focus();
                }}
              >
                {issue.message}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
