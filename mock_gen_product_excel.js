// mock_gen_product_excel.js
const ExcelJS = require("exceljs");
const readline = require("readline");
const { faker } = require("@faker-js/faker");

// Function to generate product name using faker
function generateProductName() {
  const department = faker.commerce.department();
  const product = faker.commerce.productName();
  return `${department} ${product}`;
}

// Function to generate a single product
function generateProduct(index) {
  return {
    ProductID: `P${String(index + 1).padStart(6, "0")}`,
    ProductName: generateProductName(),
    Price: parseFloat(faker.commerce.price({ min: 10, max: 2000, dec: 2 })),
    Quantity: faker.number.int({ min: 1, max: 1000 }),
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
    worksheet.addRow(product);
  }

  // Style the price column
  worksheet.getColumn("Price").numFmt = '"$"#,##0.00';

  // Style the quantity column
  worksheet.getColumn("Quantity").numFmt = "#,##0";

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
    } catch (error) {
      console.error("Error generating file:", error);
    }

    rl.close();
  });
}

// Run the script
main();
