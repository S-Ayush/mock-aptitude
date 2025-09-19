#!/bin/bash

# Enhanced Questions Setup Script
# This script imports the enhanced questions from questions.json

echo "🚀 Setting up enhanced questions system..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Check if environment variables are set
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "❌ Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables"
    echo "   You can create a .env file with:"
    echo "   VITE_SUPABASE_URL=your_supabase_url"
    echo "   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key"
    exit 1
fi

echo "📊 Environment variables found ✅"

# Run the import script
echo "📥 Importing enhanced questions from JSON..."
npm run import-questions

if [ $? -eq 0 ]; then
    echo "✅ Enhanced questions imported successfully!"
    echo ""
    echo "🎉 Setup complete! The system now includes:"
    echo "   • Section-based question organization"
    echo "   • Difficulty level indicators"
    echo "   • Category information"
    echo "   • Enhanced question navigation"
    echo "   • Better UI with section icons and difficulty colors"
    echo ""
    echo "You can now:"
    echo "   1. Start the development server: npm run dev"
    echo "   2. Access the admin panel to manage tests"
    echo "   3. Students can take the enhanced test with better UI"
else
    echo "❌ Import failed. Please check the error messages above."
    exit 1
fi
