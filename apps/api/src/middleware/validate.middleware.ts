import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError, ZodIssueCode } from 'zod';

// Spanish defaults for every schema; a message written in a schema still wins.
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      return { message: issue.received === 'undefined' ? 'Este campo es obligatorio.' : 'El tipo de dato no es válido.' };
    case ZodIssueCode.too_small:
      if (issue.type === 'string') return { message: issue.minimum === 1 ? 'Este campo no puede estar vacío.' : `Debe tener al menos ${issue.minimum} caracteres.` };
      if (issue.type === 'number') return { message: `Debe ser mayor o igual que ${issue.minimum}.` };
      if (issue.type === 'array') return { message: `Debe tener al menos ${issue.minimum} elementos.` };
      break;
    case ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `Debe tener como máximo ${issue.maximum} caracteres.` };
      if (issue.type === 'number') return { message: `Debe ser menor o igual que ${issue.maximum}.` };
      if (issue.type === 'array') return { message: `Debe tener como máximo ${issue.maximum} elementos.` };
      break;
    case ZodIssueCode.invalid_enum_value:
      return { message: `Valor no válido. Opciones: ${issue.options.join(', ')}.` };
    case ZodIssueCode.invalid_string:
      return { message: 'El formato no es válido.' };
    case ZodIssueCode.unrecognized_keys:
      return { message: `Campos no permitidos: ${issue.keys.join(', ')}.` };
  }
  return { message: ctx.defaultError };
});

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: 'Datos inválidos',
          details: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(err);
    }
  };
}
