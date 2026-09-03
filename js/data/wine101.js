/* ============================================================
   INDUSTRY BASICS — WINE 101
   Universal knowledge, not house recipes: the varietals every
   server gets asked about. Cards use attribute rows (amt = the
   attribute, item = the value) so the quiz engine can blank
   them like ingredients. Body and Sweetness use a fixed vocab
   (Light/Medium/Full, Dry/Off-dry/Sweet) so blanked answers
   stay unambiguous. No allergen data by design: library packs
   never carry allergens (see the never-guess rule).
   ============================================================ */

(function(){

const A = (body, sweet, taste, pair) => ([
  { amt: "Body",        item: body },
  { amt: "Sweetness",   item: sweet },
  { amt: "Tastes like", item: taste },
  { amt: "Pair it with", item: pair }
]);

window.PACKS = window.PACKS || [];
window.PACKS.push({
  id: "wine101",
  icon: "🍷",
  eyebrow: "Industry Basics",
  title: "Wine 101",
  tagline: "The twelve grapes guests actually ask about, one card each.",
  levels: [
    { type: "mcName", title: "The First Pour", desc: "One detail is missing from the card. Fill it in.", lives: 5,
      prompt: "Which detail completes this card?" },
    { type: "mcBlank", count: 2, title: "Blind Tasting", desc: "Two details vanish at once. Get both right.", lives: 5,
      noun: "detail" },
    { type: "mcBlank", count: 3, title: "Cellar Run", desc: "Three details vanish at once. Get them all.", lives: 4,
      noun: "detail" }
  ],
  items: [
    { name: "Cabernet Sauvignon",
      ingredients: A("Full", "Dry", "Black currant, cedar, firm grip", "Steak and anything charred"),
      sections: [{ label: "Say it to a guest", text: "cab-er-NAY so-vin-YON. The big, confident red; the default for steak people. If they want 'a bold red,' start here." }] },
    { name: "Merlot",
      ingredients: A("Medium", "Dry", "Plum, chocolate, soft finish", "Roast chicken, mushrooms, meatloaf"),
      sections: [{ label: "Say it to a guest", text: "mer-LOW. Cab's softer sibling. For guests who want red without the grip." }] },
    { name: "Pinot Noir",
      ingredients: A("Light", "Dry", "Cherry, earth, silk", "Salmon, duck, mushroom dishes"),
      sections: [{ label: "Say it to a guest", text: "PEE-no NWAR. The red for people who don't want a heavy red. The one red that loves fish." }] },
    { name: "Malbec",
      ingredients: A("Full", "Dry", "Blackberry, plum, cocoa", "Burgers, ribs, blue cheese"),
      sections: [{ label: "Say it to a guest", text: "MAHL-bek. Argentina's steak wine: big like a Cab but smoother, and usually a better price." }] },
    { name: "Zinfandel",
      ingredients: A("Full", "Dry", "Jammy raspberry, black pepper, warm spice", "Barbecue, pizza, spicy sausage"),
      sections: [{ label: "Say it to a guest", text: "ZIN-fan-del. Bold and jammy. Heads up: WHITE Zinfandel is a different thing entirely, pink and sweet." }] },
    { name: "Syrah",
      ingredients: A("Full", "Dry", "Dark fruit, smoke, cracked pepper", "Lamb, brisket, anything off the smoker"),
      sections: [{ label: "Say it to a guest", text: "sir-AH. Same grape is called Shiraz in Australia. Dark and savory, a touch wild." }] },
    { name: "Chardonnay",
      ingredients: A("Full", "Dry", "Apple, butter, vanilla when oaked", "Lobster, creamy pasta, roast chicken"),
      sections: [{ label: "Say it to a guest", text: "shar-doh-NAY. The richest white on most lists. 'Oaked' means buttery; 'unoaked' means crisp. Know which yours is." }] },
    { name: "Sauvignon Blanc",
      ingredients: A("Light", "Dry", "Grapefruit, fresh-cut grass, lime zest", "Goat cheese, salads, oysters"),
      sections: [{ label: "Say it to a guest", text: "SO-vin-yon BLONK. Zippy and refreshing, the opposite of buttery. New Zealand ones are the loudest." }] },
    { name: "Pinot Grigio",
      ingredients: A("Light", "Dry", "Pear, lemon, clean and crisp", "Light seafood, antipasti, patio afternoons"),
      sections: [{ label: "Say it to a guest", text: "PEE-no GREE-jo. The easy-drinking white; nobody sends it back. For the 'something light' guest." }] },
    { name: "Riesling",
      ingredients: A("Light", "Off-dry", "Peach, apricot, a little honey", "Spicy food, Thai, pork"),
      sections: [{ label: "Say it to a guest", text: "REES-ling. Usually a touch sweet, and that sweetness is the best friend spicy food has. Dry versions exist; check yours." }] },
    { name: "Moscato",
      ingredients: A("Light", "Sweet", "Peach, orange blossom, gentle fizz", "Dessert, brunch, fresh fruit"),
      sections: [{ label: "Say it to a guest", text: "mo-SKAH-to. Openly sweet and lightly bubbly. For the guest who says 'I don't really like wine.'" }] },
    { name: "Rosé",
      ingredients: A("Light", "Dry", "Strawberry, melon, citrus", "Charcuterie, salads, anything on a patio"),
      sections: [{ label: "Say it to a guest", text: "ro-ZAY. Pink but almost always DRY, not sweet; guests mix this up constantly. Made from red grapes with short skin contact." }] }
  ]
});

})();
