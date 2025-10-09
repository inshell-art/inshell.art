export async function call0(name: string) {
  const c: any = await contractP;
  return c.call(name, [], { blockIdentifier });
}
