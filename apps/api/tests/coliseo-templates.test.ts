import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createExerciseSchema, photoMealSchema, routineSchema } from '../src/schemas/activity.schemas';
import { mealFromPhotoReply, photoPrompt } from '../src/services/nutrition2.service';

test('ejercicio propio: nombre, grupo del catálogo y equipo opcional', () => {
  assert.ok(createExerciseSchema.safeParse({ name: 'Hip thrust', muscleGroup: 'Piernas' }).success);
  assert.ok(createExerciseSchema.safeParse({ name: 'Press en máquina', muscleGroup: 'Pecho', equipment: 'Máquina' }).success);
  assert.equal(createExerciseSchema.safeParse({ name: 'X', muscleGroup: 'Piernas' }).success, false, 'nombre muy corto');
  assert.equal(createExerciseSchema.safeParse({ name: 'Hip thrust', muscleGroup: 'Glúteos' }).success, false, 'grupo fuera del catálogo');
  assert.equal(createExerciseSchema.parse({ name: '  Hip thrust  ', muscleGroup: 'Piernas' }).name, 'Hip thrust');
});

test('rutina guardada: series objetivo con peso, repeticiones y clase de serie', () => {
  const ok = routineSchema.safeParse({
    name: 'Pecho y tríceps',
    exercises: [{
      exerciseId: 'ex1', name: 'Press de Banca', muscleGroup: 'Pecho', sets: 3, reps: 8, weight: 60,
      targetSets: [{ weight: 60, reps: 8, type: 'normal' }, { weight: 60, reps: 7, type: 'failure' }],
    }],
    estimatedDuration: 45,
  });
  assert.ok(ok.success);
  assert.equal(routineSchema.safeParse({ name: '' }).success, false, 'sin nombre no se guarda');
  assert.equal(routineSchema.safeParse({
    name: 'Mala', exercises: [{ exerciseId: 'e', name: 'X', sets: 1, targetSets: [{ type: 'fallo' }] }],
  }).success, false, 'clase de serie desconocida');
  // Las claves desconocidas no llegan a la base de datos.
  const parsed = routineSchema.parse({ name: 'R', userId: 'otra-persona' }) as Record<string, unknown>;
  assert.equal(parsed.userId, undefined);
});

test('foto del plato: solo imágenes reducidas en base64', () => {
  const image = 'A'.repeat(2000);
  assert.ok(photoMealSchema.safeParse({ image, mimeType: 'image/jpeg' }).success);
  assert.equal(photoMealSchema.safeParse({ image: 'A'.repeat(400_001), mimeType: 'image/jpeg' }).success, false, 'sin reducir: demasiado grande');
  assert.equal(photoMealSchema.safeParse({ image: `data:image/jpeg;base64,${image}`, mimeType: 'image/jpeg' }).success, false, 'sin prefijo data:');
  assert.equal(photoMealSchema.safeParse({ image, mimeType: 'image/gif' }).success, false);
});

test('foto del plato: prompt corto y respuesta compacta a la forma del análisis por texto', () => {
  const prompt = photoPrompt('es', 'arroz con pollo');
  assert.ok(prompt.length < 400, 'el prompt se mantiene corto (menos tokens)');
  assert.match(prompt, /Spanish/);
  assert.match(prompt, /Hint: arroz con pollo/);
  assert.doesNotMatch(photoPrompt('en'), /Hint/);

  const meal = mealFromPhotoReply('```json\n{"ok":true,"n":"Bandeja paisa","k":1150.6,"p":"52 g","c":110,"f":58}\n```');
  assert.deepEqual(
    { name: meal.name, kcal: meal.estimatedCalories, p: meal.estimatedProtein, c: meal.estimatedCarbs, f: meal.estimatedFat, ok: meal.recognized },
    { name: 'Bandeja paisa', kcal: 1151, p: 52, c: 110, f: 58, ok: true },
  );
  const notFood = mealFromPhotoReply('{"ok":false}', 'mi pista');
  assert.equal(notFood.recognized, false);
  assert.equal(notFood.needsIngredients, true);
  assert.equal(notFood.name, 'mi pista');
  assert.equal(mealFromPhotoReply('sin json').aiSucceeded, false);
});
