export type ActionError = {
  code: string;
  message: string;
  details?: unknown;
};

export type ActionResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: ActionError;
    };

export function actionError(
  code: string,
  message: string,
  details?: unknown,
): ActionResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };
}
