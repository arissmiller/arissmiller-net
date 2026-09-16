# Big Picture

I wanted to design a framework for analyzing text that could provide the reader to greater insight into a number of aspects that are often not readily apparent. For example, how phrasing may either intentionally or unintentionally create bias, how arguments are structured, whether there are logical fallacies, and more. This project is part of a larger idea that I am still expanding on, but this is a first working prototype. It breaks down input text using LLMs into the following layers: Represented Situation, Sources and Claims, Discourse, Construal, Framing & Rhetoric, and Implications and Argument. Texts that are less biased should be heavier in the categories that are more fact based, and lighter in the categories that include more rhetroic or argument strategies. This was demonstrated mostly using news articles. The prototype is in an early phase, but I encourage anyone reading this to try submitting a text, and see if you can find anything interesting in the result that you didn't notice on your first read.

## Project Goals
 - Better understand how to analyze text using LLMs
 - Build a framework for examining the rhetorical structure text in an objective manner
 - Draw attention to things you might not notice on your first read

## Challenges
 - Desigining a fair way to analyze rhetoric
 - Deciding on layer names and what kind of things to look for in those layers
 - Connecting the graph nodes between and across layers
