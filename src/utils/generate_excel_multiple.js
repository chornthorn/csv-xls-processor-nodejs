const ExcelJS = require("exceljs");
const readline = require("readline");
const { faker } = require("@faker-js/faker");

// Define possible tags and categories
const possibleTags = [
  "New",
  "Bestseller",
  "Sale",
  "Premium",
  "Limited",
  "Exclusive",
  "Featured",
  "Trending",
  "Popular",
  "Seasonal",
];

const possibleCategories = [
  "Electronics",
  "Gaming",
  "Office",
  "Home",
  "Accessories",
  "Computer",
  "Mobile",
  "Audio",
  "Video",
  "Networking",
];

// Function to get random items from array
function getRandomItems(array, min = 1, max = 3) {
  const count = faker.number.int({ min, max });
  return faker.helpers.arrayElements(array, count);
}

// Function to generate product name using faker
function generateProductName() {
  const department = faker.commerce.department();
  const product = faker.commerce.productName();
  return `${department} ${product}`;
}

// Function to generate a single product
function generateProduct(index) {
  const tags = getRandomItems(possibleTags);
  const categories = getRandomItems(possibleCategories);

  return {
    ProductID: `P${String(index + 1).padStart(6, "0")}`,
    ProductName: generateProductName(),
    Price: parseFloat(faker.commerce.price({ min: 10, max: 2000, dec: 2 })),
    Quantity: faker.number.int({ min: 1, max: 1000 }),
    Tags: tags.join(","),
    Categories: categories.join(","),
  };
}

// Function to generate Excel file
async function generateExcel(numProducts) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Products");

  // Add header row with styling
  worksheet.columns = [
    { header: "ProductID", key: "ProductID", width: 15 },
    { header: "ProductName", key: "ProductName", width: 40 },
    { header: "Price", key: "Price", width: 15 },
    { header: "Quantity", key: "Quantity", width: 15 },
    { header: "Tags", key: "Tags", width: 30 },
    { header: "Categories", key: "Categories", width: 30 },
  ];

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Generate and add product data
  for (let i = 0; i < numProducts; i++) {
    const product = generateProduct(i);
    const row = worksheet.addRow(product);

    // Add custom formatting for Tags and Categories cells
    const tagsCell = row.getCell("Tags");
    const categoriesCell = row.getCell("Categories");

    // Add data validation for Tags and Categories
    tagsCell.dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${possibleTags.join(",")}"`],
    };

    categoriesCell.dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${possibleCategories.join(",")}"`],
    };

    // Add comments to explain multiple values
    tagsCell.note = {
      texts: [
        {
          text: "Multiple values separated by commas",
          font: { bold: true },
        },
      ],
    };

    categoriesCell.note = {
      texts: [
        {
          text: "Multiple values separated by commas",
          font: { bold: true },
        },
      ],
    };
  }

  // Style the price column
  worksheet.getColumn("Price").numFmt = '"$"#,##0.00';

  // Style the quantity column
  worksheet.getColumn("Quantity").numFmt = "#,##0";

  // Style Tags and Categories columns
  worksheet.getColumn("Tags").alignment = { wrapText: true };
  worksheet.getColumn("Categories").alignment = { wrapText: true };

  // Add borders to all cells
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  // Add a legend worksheet
  const legendSheet = workbook.addWorksheet("Legend");
  legendSheet.addRow(["Available Tags:", possibleTags.join(", ")]);
  legendSheet.addRow(["Available Categories:", possibleCategories.join(", ")]);
  legendSheet.getColumn(1).width = 20;
  legendSheet.getColumn(2).width = 100;

  return workbook;
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Main function to prompt user and generate file
async function main() {
  rl.question("How many products do you want to generate? ", async (answer) => {
    const numProducts = parseInt(answer);

    if (isNaN(numProducts) || numProducts <= 0) {
      console.log("Please enter a valid positive number.");
      rl.close();
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `products_${numProducts}_${timestamp}.xlsx`;

    try {
      console.log("Generating Excel file...");
      const workbook = await generateExcel(numProducts);
      await workbook.xlsx.writeFile(fileName);

      console.log(
        `Successfully generated ${fileName} with ${numProducts} products!`
      );
      console.log("\nPreview of first 5 records:");

      // Get the worksheet
      const worksheet = workbook.getWorksheet("Products");

      // Display headers
      const headers = worksheet.getRow(1).values.slice(1);
      console.log(headers.join("\t"));

      // Display first 5 rows
      for (let i = 2; i <= Math.min(6, worksheet.rowCount); i++) {
        const row = worksheet.getRow(i).values.slice(1);
        console.log(row.join("\t"));
      }

      // Display statistics
      console.log("\nGeneration Statistics:");
      console.log(`Total Products: ${numProducts}`);
      console.log(`Available Tags: ${possibleTags.length}`);
      console.log(`Available Categories: ${possibleCategories.length}`);
    } catch (error) {
      console.error("Error generating file:", error);
    }

    rl.close();
  });
}

// Add command line argument support
if (process.argv.length > 2) {
  const numProducts = parseInt(process.argv[2]);
  if (!isNaN(numProducts) && numProducts > 0) {
    generateExcel(numProducts)
      .then((workbook) => {
        const fileName = `products_${numProducts}_${new Date()
          .toISOString()
          .replace(/[:.]/g, "-")}.xlsx`;
        return workbook.xlsx.writeFile(fileName);
      })
      .then(() => {
        console.log(`Generated ${fileName} with ${numProducts} products!`);
        process.exit(0);
      })
      .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
      });
  }
}

// Run the interactive script if no command line arguments
main();
