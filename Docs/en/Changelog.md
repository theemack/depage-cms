Changelog     {#changelog}
=========

[TOC]

Version 2.4   {#v2-4}
===========

**User Interface Highlights**

- Enhanced [Dashboard](@ref dashboard)
- Complete revamp of the [Edit Interface](@ref editing-pages)
- Completely overhauled [text editor](@ref text-editor)
- New [Project shortcuts](@ref project-shortcuts) to quickly add new news- or blog posts
- Revamped [file library](@ref file-library)
- New [file search](@ref file-search)
- New function to [choose gravitational centers](@ref image-gravitational-center) for images
- New editor for [color schemes](@ref colors)
- Enhanced [preview](@ref page-preview) to automatically show currently edited language
- Enhanced preview to [highlight](@ref page-preview) the currently selected document property
- New mobile interface
- New online [user manual](https://docs.depage.net/depage-cms-manual/de/)


v2.4.0 / 29.05.2023      {#v2-4-0}
-------------------

**Backend**
- enhanced newsletter sending
- updated sitemap generator to support custom sitemaps and splitting between multiple sitemaps
- added new urlanalyzer to be used from templates
- enhanced base xsl templates
- added Imagick Provider for image generator
- various bug fixes

**Frontend**
- added option to add additional manual content to newsletters
- updated options to edit user permissions for projects


v2.3.1 / 08.08.2022      {#v2-3-1}
-------------------

**Backend**
- updated default user to be able to publish project but not to release pages directly

**Frontend**
- enhanced release pages workflow


v2.3.0 / 29.03.2022      {#v2-3-0}
-------------------

**Backend**
- enhanced newsletter sending
- enhanced base xsl to simplify srcsets
- various small bug fixes
- updated some composer dependencies

**Frontend**
- added new mobile layout for small screens like mobile phones and touch screens


v2.2.0 / 19.11.2021      {#v2-2-0}
-------------------

**Backend**
- added new file library
- added new file search
- enhanced performance when publishing file library
- added ability to name and move folder in library while keeping file references
- added new to task to automatically update all projects
- enhanced base xsl templates

**Frontend**
- enhanced file library
- added search interface for file library
- added ability to choose gravitational center of images
- added live-preview when editing color schemes
- fixed various smaller bugs


v2.1.14 / 29.04.2021      {#v2-1-14}
-------------------

**Backend**
- added various small bug fixes
- added enhancements for php 8

**Frontend**
- enhanced newsletter form
- added download sharing to file library


v2.1.13 / 26.01.2021      {#v2-1-13}
-------------------

**Backend**
- updated and enhanced graphics classes
- enhanced support for webp files
- enhanced base xsl templates
- enhanced support for picture elements


v2.1.12 / 03.11.2020      {#v2-1-12}
-------------------

**Backend**
- enhanced project updated task
- enhanced base xsl templates


v2.1.11 / 16.09.2020      {#v2-1-11}
-------------------

**Frontend**
- added Custom UI addons for projects

**Backend**
- refactored api routing
- optimized publishing and newsletter sending tasks
- updated included http classes to latest version


v2.1.10 / 03.08.2020      {#v2-1-10}
-------------------

**Backend**
- made it possible to allow project specific api calls in preview
- updated task runner to automatically retry failed subtasks


v2.1.9 / 11.07.2020      {#v2-1-9}
-------------------

**Backend**
- updated depage-fs to the latest version
- updated redirect template not to output additional content


v2.1.8 / 26.06.2020      {#v2-1-8}
-------------------

**Backend**
- added performance optimizations to XmlNav
- added performance optimizations when autosaving DocProperties
- refactored publishing tasks
- enhanced xsl templates for atom feeds


v2.1.7 / 19.06.2020      {#v2-1-7}
-------------------

**Backend**
- added new release request notifications for editors


v2.1.6 / 12.06.2020      {#v2-1-6}
-------------------

**Frontend**
- multiple bug fixes

**Backend**
- updated new-nodes to support multiple sub-elements
- multiple bug fixes


v2.1.5 / 25.05.2020      {#v2-1-5}
-------------------

**Backend**
- added additional helper functions to xsl templates
- optimized performance of base xsl templates


v2.1.4 / 19.05.2020      {#v2-1-4}
-------------------

**Frontend**
- fixed language of previews

**Backend**
- updated definition xml templates
- enhanced base xsl templates
- various bugfixes


v2.1.3 / 16.04.2020      {#v2-1-3}
-------------------

**Backend**
- various bugfixes


v2.1.2 / 03.04.2020      {#v2-1-2}
-------------------

**Frontend**
- enhanced preview to updated some changes directly in html dom
- enhanced performance of preview updates
- fixed bug with link dialog in Google Chrome
- fixed bug in newsletter preview
- fixed bugs in richtext editor

**Backend**
- added publish notification with urls of changed pages
- updated publishing order to upload last changes first
- fixed bug with file previews
- refactored xml navigation related code
- added php 7.4 related changes


v2.1.1 / 24.01.2020      {#v2-1-1}
-------------------

**Frontend**
- added ability to clear transform cache before publishing

**Backend**
- optimized publishing process


v2.1.0 / 22.01.2020      {#v2-1-0}
-------------------

**Frontend**
- added ability to protect pages from changes
- added ability to browse and rollback page data from history
- enhanced styling of tree component
- updated and enhanced setting dialogs
- fixed autosaving of forms

**Backend**

- Updated and enhanced *XmlDb*
- Optimized performance of *XmlDb*
- added page history browser
- added ability to clear page trash
- updated support packages
- added integration of the depage-analytics plugin
- fixed bug where user for new pages was not assigned correctly


v2.0.9 / 25.11.2019      {#v2-0-9}
-------------------

**Frontend**
- enhanced usability of pagedata-tree on selection
- enhanced file upload

**Backend**

- enhanced project-update method
- enhanced login/logout behavior


v2.0.8 / 14.03.2019      {#v2-0-8}
-------------------

**Frontend**

- added new *number* type to doc-properties

**Backend**

- made *$projectName* available to use in xsl templates
- fixed bug in task-runner
- fixed bug in project shortcut handling

v2.0.7 / 07.03.2019      {#v2-0-7}
-------------------

**Frontend**

- added option to copy live-url of published file

**Backend**

- enhanced publishing to allow redirect to new url when renaming published page
- updated published to autogenerate custom image sizes
- fixed bug when loading xml templates
- enhanced xsl templates when generating absolute references
- optimized performance of publishing task


v2.0.6 / 31.01.2019      {#v2-0-6}
-------------------

**Frontend**

- Fixed bug in autosaving doc-properties


v2.0.5 / 18.01.2019      {#v2-0-5}
-------------------

**Backend**

- Fixed a bug in XmlForm when saving attribute nodes with special characters


v2.0.4 / 26.12.2018      {#v2-0-4}
-------------------

**Backend**

- Added better error handling for FsFtp
- Fixed bug in XmlDb


v2.0.3 / 10.12.2018      {#v2-0-3}
-------------------

**Backend**

- Extended session lifetime for up to a week
- Added missing translations


v2.0.2 / 06.12.2018      {#v2-0-2}
-------------------

**User Interface**

- Fixed editing of footnotes
- Fixed bug with preview language
- Fixed bug when displaying faile background processes
- Added ability to edit color on doc-properties

**Backend**

- Optimized base xsl template for performance


v2.0.1 / 20.11.2018      {#v2-0-1}
-------------------

**User Interface**

- Enhancement of page status
- Update of file library to show publishing state of current file
- Optimization of delete dialog


v2.0.0 / 03.11.2018      {#v2-0-0}
-------------------

**User Interface**

- Complete overhaul of the edit interface

**Backend**

- Enhanced, simplified and optimized base xsl templates
- Added project wide config
- New routing options
- Alias support
- Updated release and publish workflow
- Websocket server for instant task, notification and document updates
- Updated and enhanced *xmldb*
- New states *isPublished* and *isReleased* in document tree
- Removed old dependencies
- Enhanced api
- Better IPv6 support
