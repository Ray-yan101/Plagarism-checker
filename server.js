const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const { SequenceMatcher } = require("difflib");
const mammoth = require("mammoth"); // For reading .docx files

const app = express();
const PORT = 3000;

// Middleware for static files (CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// Set up file storage for uploads
const upload = multer({
  dest: path.join(__dirname, "uploads"),
});

// Helper function to extract text from .txt files
const extractTextFromTxtFile = (filePath) => {
  return fs.readFileSync(filePath, "utf-8");
};

// Helper function to extract text from .docx files using 'mammoth'
const extractTextFromDocxFile = (filePath) => {
  return new Promise((resolve, reject) => {
    mammoth.extractRawText({ path: filePath })
      .then((result) => {
        resolve(result.value);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

// Function to check plagiarism (using SequenceMatcher)
const checkPlagiarism = (text1, text2) => {
  const matcher = new SequenceMatcher(null, text1, text2);
  const similarity = matcher.ratio();
  return similarity;
};

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Check for plagiarism
app.post("/check", upload.array("files", 2), async (req, res) => {
  const files = req.files;

  if (!files || files.length !== 2) {
    return res.status(400).send({ message: "Please upload exactly two files." });
  }

  try {
    const [file1, file2] = files;
    
    // Check the file extensions to determine how to process them
    const file1Path = file1.path;
    const file2Path = file2.path;

    // Extract text from txt or docx
    let text1, text2;
    if (file1.originalname.endsWith(".txt")) {
      text1 = extractTextFromTxtFile(file1Path);
    } else if (file1.originalname.endsWith(".docx")) {
      text1 = await extractTextFromDocxFile(file1Path);
    }

    if (file2.originalname.endsWith(".txt")) {
      text2 = extractTextFromTxtFile(file2Path);
    } else if (file2.originalname.endsWith(".docx")) {
      text2 = await extractTextFromDocxFile(file2Path);
    }

    // Perform plagiarism check
    const similarity = checkPlagiarism(text1, text2);
    const isPlagiarized = similarity > 0.7; // 70% similarity threshold

    // Clean up uploaded files
    files.forEach((file) => fs.unlinkSync(file.path));

    // Respond with similarity and plagiarism status
    res.json({
      similarity: (similarity * 100).toFixed(2) + "%",
      status: isPlagiarized ? "Plagiarism Detected" : "Plagiarism-Free",
    });
  } catch (error) {
    res.status(500).send({ message: "Error processing files." });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
