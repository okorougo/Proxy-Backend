import prisma from "../src/lib/prisma";

async function main() {

   const categories = [
  {
    name: "Fashion & Apparel",
    description: "Clothing, shoes, bags, and accessories.",
    iconLib: "Ionicons",
    iconName: "shirt-outline",
    imageUrl: "",
    subcategories: [
      { name: "Men's Wear" },
      { name: "Women's Wear" },
      { name: "Children's Clothing" },
      { name: "Shoes" },
      { name: "Bags" },
      { name: "Jewelry" },
      { name: "Watches" },
      { name: "Accessories" },
    ],
  },

  {
    name: "Electronics & Gadgets",
    description: "Smartphones, laptops, headphones, and more.",
    iconLib: "Feather",
    iconName: "smartphone",
    subcategories: [
      { name: "Smartphones" },
      { name: "Laptops" },
      { name: "Tablets" },
      { name: "Headphones & Earbuds" },
      { name: "Bluetooth Speakers" },
      { name: "Cameras" },
      { name: "Wearables" },
      { name: "Computer Accessories" },
    ],
  },

  {
    name: "Home & Furniture",
    description: "Furniture, decor, and kitchen appliances.",
    iconLib: "Ionicons",
    iconName: "home-outline",
    subcategories: [
      { name: "Living Room Furniture" },
      { name: "Bedroom Furniture" },
      { name: "Office Furniture" },
      { name: "Kitchen Appliances" },
      { name: "Home Decor" },
      { name: "Lighting" },
      { name: "Storage & Organization" },
    ],
  },

  {
    name: "Food & Drinks",
    description: "Snacks, groceries, and beverages.",
    iconLib: "Ionicons",
    iconName: "fast-food-outline",
    subcategories: [
      { name: "Groceries" },
      { name: "Snacks" },
      { name: "Breakfast Foods" },
      { name: "Soft Drinks" },
      { name: "Water & Juice" },
      { name: "Frozen Foods" },
      { name: "Alcoholic Drinks" },
    ],
  },

  {
    name: "Real Estate & Property",
    description: "Houses, land, rentals, and offices.",
    iconLib: "Ionicons",
    iconName: "business-outline",
    subcategories: [
      { name: "For Sale" },
      { name: "For Rent" },
      { name: "Land" },
      { name: "Commercial Property" },
      { name: "Short Let" },
      { name: "New Developments" },
    ],
  },

  {
    name: "Vehicles & Auto Parts",
    description: "Cars, bikes, and spare parts.",
    iconLib: "Ionicons",
    iconName: "car-outline",
    subcategories: [
      { name: "Cars" },
      { name: "Motorcycles" },
      { name: "Trucks" },
      { name: "Auto Parts" },
      { name: "Car Accessories" },
      { name: "Tyres & Batteries" },
      { name: "Vehicle Services" },
    ],
  },

  {
    name: "Mobile Accessories",
    description: "Chargers, cables, and phone cases.",
    iconLib: "Feather",
    iconName: "headphones",
    subcategories: [
      { name: "Chargers" },
      { name: "USB Cables" },
      { name: "Power Banks" },
      { name: "Phone Cases" },
      { name: "Screen Protectors" },
      { name: "AirPods & Earbuds" },
      { name: "Bluetooth Devices" },
    ],
  },

  {
    name: "Books & Education",
    description: "Books, stationery, and study materials.",
    iconLib: "Ionicons",
    iconName: "book-outline",
    subcategories: [
      { name: "Textbooks" },
      { name: "Children's Books" },
      { name: "Novels" },
      { name: "E-learning Materials" },
      { name: "Stationery" },
      { name: "Past Questions" },
    ],
  },

  {
    name: "Beauty & Personal Care",
    description: "Makeup, skincare, and fragrances.",
    iconLib: "Ionicons",
    iconName: "color-palette-outline",
    subcategories: [
      { name: "Makeup" },
      { name: "Skincare" },
      { name: "Fragrances" },
      { name: "Haircare" },
      { name: "Personal Hygiene" },
      { name: "Beard Care" },
    ],
  },

  {
    name: "Baby & Kids",
    description: "Toys, clothing, and accessories for kids.",
    iconLib: "Ionicons",
    iconName: "happy-outline",
    subcategories: [
      { name: "Baby Clothing" },
      { name: "Kids Clothing" },
      { name: "Baby Food" },
      { name: "Toys" },
      { name: "Strollers" },
      { name: "Kids Accessories" },
    ],
  },

  {
    name: "Jobs & Services",
    description: "Find skilled professionals and job listings.",
    iconLib: "Ionicons",
    iconName: "briefcase-outline",
    subcategories: [
      { name: "Job Vacancies" },
      { name: "Freelancers" },
      { name: "Home Services" },
      { name: "Repairs" },
      { name: "Tutoring" },
      { name: "Event Services" },
    ],
  },

  {
    name: "Digital Products",
    description: "Software, templates, and online tools.",
    iconLib: "Ionicons",
    iconName: "cloud-outline",
    subcategories: [
      { name: "Templates" },
      { name: "Ebooks" },
      { name: "Music" },
      { name: "Software Licenses" },
      { name: "Courses" },
      { name: "Graphics Designs" },
    ],
  },

  {
    name: "Gaming & Consoles",
    description: "Games, consoles, and accessories.",
    iconLib: "Ionicons",
    iconName: "game-controller-outline",
    subcategories: [
      { name: "PlayStation" },
      { name: "Xbox" },
      { name: "Nintendo" },
      { name: "Gaming Accessories" },
      { name: "PC Gaming" },
      { name: "Game Codes" },
    ],
  },

  {
    name: "Pets & Animals",
    description: "Pet food, accessories, and adoptions.",
    iconLib: "Ionicons",
    iconName: "paw-outline",
    subcategories: [
      { name: "Pet Food" },
      { name: "Pet Accessories" },
      { name: "Pet Adoption" },
      { name: "Pet Healthcare" },
      { name: "Livestock" },
    ],
  },

  {
    name: "Agriculture & Farm",
    description: "Farming tools, livestock, and produce.",
    iconLib: "Ionicons",
    iconName: "leaf-outline",
    subcategories: [
      { name: "Farm Tools" },
      { name: "Seeds" },
      { name: "Fertilizers" },
      { name: "Livestock" },
      { name: "Farm Produce" },
      { name: "Agro Chemicals" },
    ],
  },

  {
    name: "Building Materials",
    description: "Cement, steel, and construction supplies.",
    iconLib: "Ionicons",
    iconName: "construct-outline",
    subcategories: [
      { name: "Cement" },
      { name: "Steel Rods" },
      { name: "Paints" },
      { name: "Pipes" },
      { name: "Tiles" },
      { name: "Blocks" },
    ],
  },

  {
    name: "Events & Entertainment",
    description: "Tickets, DJs, and event planning services.",
    iconLib: "Ionicons",
    iconName: "musical-notes-outline",
    subcategories: [
      { name: "Event Tickets" },
      { name: "Event Planners" },
      { name: "Musicians & DJs" },
      { name: "Party Supplies" },
      { name: "Photography" },
      { name: "Videography" },
    ],
  },

  {
    name: "Health & Fitness",
    description: "Gym equipment, supplements, and wellness.",
    iconLib: "Ionicons",
    iconName: "fitness-outline",
    subcategories: [
      { name: "Gym Equipment" },
      { name: "Supplements" },
      { name: "Medical Devices" },
      { name: "Wellness" },
      { name: "Sportswear" },
    ],
  },

  {
    name: "Travel & Logistics",
    description: "Flights, transport, and courier services.",
    iconLib: "Ionicons",
    iconName: "airplane-outline",
    subcategories: [
      { name: "Flights" },
      { name: "Hotels" },
      { name: "Car Rentals" },
      { name: "Logistics Services" },
      { name: "Tour Packages" },
    ],
  },

  {
    name: "Office & Work Tools",
    description: "Printers, desks, and office supplies.",
    iconLib: "Ionicons",
    iconName: "laptop-outline",
    subcategories: [
      { name: "Office Furniture" },
      { name: "Printers & Scanners" },
      { name: "Office Electronics" },
      { name: "Stationery" },
      { name: "Work Tools" },
    ],
  },
];


 for (const cat of categories) {
    const existing = await prisma.category.upsert({
      where: { name: cat.name },
      update: {
        description: cat.description,
        iconLib: cat.iconLib,
        iconName: cat.iconName,
      },
      create: {
        name: cat.name,
        description: cat.description,
        iconLib: cat.iconLib,
        iconName: cat.iconName,
      },
    });

    // Seed subcategories
    for (const sub of cat.subcategories || []) {
      await prisma.subCategory.upsert({
        where: {
          name_categoryId: {
            name: sub.name,
            categoryId: existing.id,
          },
        },
        update: {},
        create: {
          name: sub.name,
          categoryId: existing.id,
        },
      });
    }
  }

  console.log("✅ Categories seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
