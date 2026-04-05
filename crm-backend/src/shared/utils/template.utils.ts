/**
 * Template Utilities
 *
 * Handlebars-based template rendering for dynamic content in:
 *  - Automation action executor (email subjects, SMS body, task titles)
 *  - Email template service (transactional emails)
 *  - Notification messages
 *
 * Centralised here so Handlebars is only configured in one place.
 * No NestJS imports.
 *
 * Template syntax: {{lead.firstName}}, {{deal.value}}, {{contact.email}}
 * Dot-notation paths are resolved against the data object.
 */

import Handlebars from 'handlebars';

// Register helpers once at module load
Handlebars.registerHelper('upper', (str: string) =>
  typeof str === 'string' ? str.toUpperCase() : str,
);

Handlebars.registerHelper('lower', (str: string) =>
  typeof str === 'string' ? str.toLowerCase() : str,
);

Handlebars.registerHelper('currency', (value: number, currency = 'USD') => {
  if (typeof value !== 'number') return value;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
});

Handlebars.registerHelper('date', (isoString: string) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

Handlebars.registerHelper('ifEq', function (
  this: unknown,
  a: unknown,
  b: unknown,
  options: Handlebars.HelperOptions,
) {
  return a === b ? options.fn(this) : options.inverse(this);
});

/**
 * Renders a Handlebars template string against a data context.
 * Returns the original template unchanged if compilation or rendering fails
 * (fail-open: a broken template should not break the underlying action).
 *
 * @example
 * renderTemplate('Hello {{lead.firstName}}!', { lead: { firstName: 'Jane' } })
 * // → 'Hello Jane!'
 */
export function renderTemplate(
  template: string,
  data: Record<string, unknown>,
): string {
  try {
    const compiled = Handlebars.compile(template, { noEscape: true });
    return compiled(data);
  } catch {
    return template;
  }
}

/**
 * Renders multiple template fields at once.
 * Useful when an action config has several string fields to interpolate.
 *
 * @example
 * const rendered = renderTemplateFields(
 *   { subject: 'Hi {{contact.firstName}}', body: 'Your deal {{deal.name}} moved.' },
 *   eventData,
 * );
 */
export function renderTemplateFields<T extends Record<string, unknown>>(
  fields: T,
  data: Record<string, unknown>,
): T {
  const result = {} as T;
  for (const [key, value] of Object.entries(fields)) {
    (result as Record<string, unknown>)[key] =
      typeof value === 'string' ? renderTemplate(value, data) : value;
  }
  return result;
}
