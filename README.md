# codemirror-modern-search-replace
A more user friendly version of Codemirror's built in search addon. 

## Notable Changes
- The search panel is replaced with a search/replace panel
- This panel is persistent by default (won't close automatically on blur or enter press)
- Buttons for the most common navigations, instead of memorizing the old hotkey scheme.

So these:

![Old Search](https://github.com/bryanchapel/codemirror-modern-search-replace/blob/master/screenshots/oldsearch.png "Old Search")
![Old Replace](https://github.com/bryanchapel/codemirror-modern-search-replace/blob/master/screenshots/oldreplace.png "Old Replace")

Become these:

![New Search](https://github.com/bryanchapel/codemirror-modern-search-replace/blob/master/screenshots/newsearch.png "New Search")
![New Replace](https://github.com/bryanchapel/codemirror-modern-search-replace/blob/master/screenshots/newreplace.png "New Replace")

(BYOS: bring your own styling :-) )

Note: Since I'm using this as part of a side project, this particular version has a Bootstrap 4 dependency for some of the button icons. I've also gone with strictly CommonJS for the imports/exports.

This will be cleaned up and released on NPM shortly for easy drop-in to other Codemirror based projects.
