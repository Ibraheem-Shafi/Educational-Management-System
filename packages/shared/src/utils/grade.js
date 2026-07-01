"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = formatCurrency;
exports.calculatePercentage = calculatePercentage;
exports.calculateGrade = calculateGrade;
function formatCurrency(amount, currency = 'PKR') {
    return new Intl.NumberFormat('en-PK', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}
function calculatePercentage(obtained, total) {
    if (total <= 0)
        return 0;
    return Math.round((obtained / total) * 10000) / 100;
}
function calculateGrade(percentage) {
    if (percentage >= 90)
        return 'A+';
    if (percentage >= 80)
        return 'A';
    if (percentage >= 70)
        return 'B';
    if (percentage >= 60)
        return 'C';
    if (percentage >= 50)
        return 'D';
    return 'F';
}
//# sourceMappingURL=grade.js.map