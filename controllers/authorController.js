import Author from '../models/Author.js';

// Get all authors
export const getAuthors = async (req, res) => {
  try {
    const authors = await Author.find({ isActive: true }).sort({ name: 1 });
    res.json({ data: authors });
  } catch (error) {
    console.error('Error fetching authors:', error);
    res.status(500).json({ error: 'Failed to fetch authors' });
  }
};

// Get single author
export const getAuthor = async (req, res) => {
  try {
    const author = await Author.findById(req.params.id);
    
    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }
    
    res.json(author);
  } catch (error) {
    console.error('Error fetching author:', error);
    res.status(500).json({ error: 'Failed to fetch author' });
  }
};

// Create author
export const createAuthor = async (req, res) => {
  try {
    const author = new Author(req.body);
    await author.save();
    res.status(201).json(author);
  } catch (error) {
    console.error('Error creating author:', error);
    res.status(400).json({ error: error.message || 'Failed to create author' });
  }
};

// Update author
export const updateAuthor = async (req, res) => {
  try {
    const author = await Author.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }
    
    res.json(author);
  } catch (error) {
    console.error('Error updating author:', error);
    res.status(400).json({ error: error.message || 'Failed to update author' });
  }
};

// Delete author
export const deleteAuthor = async (req, res) => {
  try {
    const author = await Author.findByIdAndDelete(req.params.id);
    
    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting author:', error);
    res.status(500).json({ error: 'Failed to delete author' });
  }
};











