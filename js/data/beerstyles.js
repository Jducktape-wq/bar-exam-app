/* ============================================================
   INDUSTRY BASICS — BEER STYLES
   Universal knowledge: what the styles on any tap list mean and
   who to pour them for. Attribute-card format (amt = attribute,
   item = value); Body uses the Light/Medium/Full vocab. No
   allergen data by design (library packs never carry it).
   ============================================================ */

(function(){

const A = (looks, body, taste, order) => ([
  { amt: "Looks",        item: looks },
  { amt: "Body",         item: body },
  { amt: "Tastes like",  item: taste },
  { amt: "Pour it for",  item: order }
]);

window.PACKS = window.PACKS || [];
window.PACKS.push({
  id: "beerstyles",
  icon: "🍺",
  eyebrow: "Industry Basics",
  title: "Beer Styles",
  tagline: "Every style on a tap list, and who it's for.",
  levels: [
    { type: "mcName", title: "First Round", desc: "One detail is missing from the card. Fill it in.", lives: 5,
      prompt: "Which detail completes this card?" },
    { type: "mcBlank", count: 2, title: "Flight Night", desc: "Two details vanish at once. Get both right.", lives: 5,
      noun: "detail" },
    { type: "mcBlank", count: 3, title: "Brewmaster", desc: "Three details vanish at once. Get them all.", lives: 4,
      noun: "detail" }
  ],
  items: [
    { name: "Lager",
      ingredients: A("Pale gold, brilliantly clear", "Light", "Crisp, clean, gentle malt", "The 'just a beer' guest; hot days"),
      sections: [{ label: "Say it to a guest", text: "The world's default beer. Cold, clean, no surprises. When in doubt, this is the safe pour." }] },
    { name: "Pilsner",
      ingredients: A("Bright gold, snappy white head", "Light", "Crisp with a dry, peppery hop finish", "Lager drinkers ready for one step up"),
      sections: [{ label: "Say it to a guest", text: "A lager with better posture. Same crispness, a little more bite at the end." }] },
    { name: "Hefeweizen",
      ingredients: A("Hazy straw, thick fluffy head", "Medium", "Banana and clove, no bitterness", "Guests who want smooth and a little different"),
      sections: [{ label: "Say it to a guest", text: "HAY-fuh-vite-zen. German wheat beer; the banana-clove flavor comes from the yeast, not added fruit." }] },
    { name: "Pale Ale",
      ingredients: A("Amber gold", "Medium", "Citrusy hops balanced by toasty malt", "The middle ground between lager and IPA"),
      sections: [{ label: "Say it to a guest", text: "Hoppy, but polite about it. The gateway to IPAs." }] },
    { name: "IPA",
      ingredients: A("Gold to light amber", "Medium", "Big hops: pine, citrus, real bitterness", "The hop-head; they'll ask for it by name"),
      sections: [{ label: "Say it to a guest", text: "India Pale Ale. Bitterness is the point, not a flaw. If they hesitate, offer the hazy instead." }] },
    { name: "Hazy IPA",
      ingredients: A("Opaque, looks like juice", "Medium", "Tropical fruit juice, soft finish", "Wants IPA flavor without the bitter bite"),
      sections: [{ label: "Say it to a guest", text: "Also called New England IPA. All the hop aroma, a fraction of the bitterness. Converts IPA skeptics." }] },
    { name: "Amber Ale",
      ingredients: A("Deep copper", "Medium", "Caramel malt, toffee, mild hops", "Malt over hops; the burger beer"),
      sections: [{ label: "Say it to a guest", text: "Toasty and smooth. For guests who find IPAs too bitter and stouts too heavy." }] },
    { name: "Brown Ale",
      ingredients: A("Chestnut brown", "Medium", "Nutty, bready, lightly sweet", "Cozy drinkers; roasty but not heavy"),
      sections: [{ label: "Say it to a guest", text: "Tastes like the smell of a bakery. Underrated with anything roasted or grilled." }] },
    { name: "Porter",
      ingredients: A("Dark brown to black", "Medium", "Chocolate and coffee, gentle roast", "Dessert-adjacent; the stout-curious"),
      sections: [{ label: "Say it to a guest", text: "Stout's slightly lighter cousin. Dark in color but smoother than it looks." }] },
    { name: "Stout",
      ingredients: A("Black, creamy tan head", "Full", "Roasted coffee, dark chocolate, creamy", "The nightcap; pairs with dessert"),
      sections: [{ label: "Say it to a guest", text: "Looks intimidating, drinks smooth. Fun fact for guests: a classic dry stout has fewer calories than most IPAs." }] },
    { name: "Sour",
      ingredients: A("Varies; often hazy gold or fruit-tinted", "Light", "Tart, fruity, puckery", "Wine drinkers and the adventurous"),
      sections: [{ label: "Say it to a guest", text: "Tart on purpose. Warn first-timers it's supposed to taste that way, then watch them order a second." }] }
  ]
});

})();
