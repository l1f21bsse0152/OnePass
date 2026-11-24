import { describe, expect, it } from 'vitest';

import { DEFAULT_CARD_DESIGN, parseCardDesign } from '../src/theme/cardDesign';

describe('card design preferences', () => {
  it('maps saved editions to the updated skin collection', () => {
    expect(parseCardDesign('emerald:mint')).toEqual({
      skinId: 'christmas',
      accentId: 'mint',
    });
    expect(parseCardDesign('solar:gold')).toEqual({
      skinId: 'valentine',
      accentId: 'gold',
    });
  });

  it('uses the default design when saved values are invalid', () => {
    expect(parseCardDesign('unknown:unknown')).toEqual(DEFAULT_CARD_DESIGN);
  });
});
