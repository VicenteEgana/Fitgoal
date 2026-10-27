import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { bmiCategory, bodyMassIndex, bodyOf } from '../src/lib/body.js';

describe('IMC y categorías (OMS para adultos; Minsal para personas mayores)', () => {
  test('IMC = peso / estatura², redondeado a un decimal', () => {
    assert.equal(bodyMassIndex(70, 175), 22.9);
    assert.equal(bodyMassIndex(95, 170), 32.9);
    assert.equal(bodyMassIndex(50, 170), 17.3);
    assert.equal(bodyMassIndex(0, 170), null);
    assert.equal(bodyMassIndex(70, 0), null);
  });

  test('personas adultas: cortes de la OMS en 18,5, 25 y 30', () => {
    const at = bmi => bmiCategory(bmi, 30);
    assert.deepEqual([18.4, 18.5, 24.9, 25, 29.9, 30, 41].map(at), ['bajo_peso', 'normal', 'normal', 'sobrepeso', 'sobrepeso', 'obesidad', 'obesidad']);
  });

  test('personas mayores (65 años o más): cortes del Minsal en 23, 28 y 32', () => {
    const at = bmi => bmiCategory(bmi, 70);
    assert.deepEqual([22.9, 23, 27.9, 28, 31.9, 32].map(at), ['bajo_peso', 'normal', 'normal', 'sobrepeso', 'sobrepeso', 'obesidad']);
    assert.equal(bmiCategory(22, 64), 'normal', 'a los 64 años rigen los cortes de la OMS');
    assert.equal(bmiCategory(22, 65), 'bajo_peso', 'desde los 65 años rigen los del Minsal');
  });

  test('bodyOf toma la fila del perfil y devuelve null si faltan la estatura o el peso', () => {
    assert.deepEqual(bodyOf({ weight_kg: '82.0', height_cm: '172.0', age: 30 }), { bmi: 27.7, category: 'sobrepeso' });
    assert.equal(bodyOf({ weight_kg: null, height_cm: null, age: 30 }), null);
    assert.equal(bodyOf(null), null);
  });
});
