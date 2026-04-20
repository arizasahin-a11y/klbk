const cellStr = "12-B";
let match = cellStr.match(/\d{1,2}\s*[-/]?\s*[A-ZÇĞİÖŞÜa-zçğıöşü]+/i);
console.log(match);
