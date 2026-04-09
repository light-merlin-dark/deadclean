export function usedFunction(value: number): number {
  return value + 1;
}

export function deadFunction(): number {
  const data = [1, 2, 3];
  return data.reduce((sum, item) => sum + item, 0);
}

console.log(usedFunction(3));
