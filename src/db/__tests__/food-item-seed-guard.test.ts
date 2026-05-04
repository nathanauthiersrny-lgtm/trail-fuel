import { SeedItemDeleteError } from '../../models/food-item';

describe('SeedItemDeleteError', () => {
  it('has the correct name', () => {
    const err = new SeedItemDeleteError();
    expect(err.name).toBe('SeedItemDeleteError');
  });

  it('carries the prescribed user-facing message', () => {
    const err = new SeedItemDeleteError();
    expect(err.message).toBe(
      "Cet item fait partie de la bibliothèque par défaut et ne peut pas être supprimé. Tu peux modifier ses valeurs si besoin.",
    );
  });

  it('is an instance of Error', () => {
    expect(new SeedItemDeleteError()).toBeInstanceOf(Error);
  });

  it('can be caught as SeedItemDeleteError', () => {
    function tryDelete() {
      throw new SeedItemDeleteError();
    }
    expect(() => tryDelete()).toThrow(SeedItemDeleteError);
    expect(() => tryDelete()).toThrow('bibliothèque par défaut');
  });
});
