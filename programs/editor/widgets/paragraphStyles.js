/**
 * Copyright (C) 2012 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: http://gitorious.org/webodf/webodf/
 */
/*global define,require */
define("webodf/editor/widgets/paragraphStyles", [], function () {
    "use strict";
    var ParagraphStyles = function (editorSession, callback) {
        var self = this,
            select;

        this.widget = function () {
            return select;
        };

        this.value = function () {
            return select.get('value');
        };

        this.setValue = function (value) {
            select.set('value', value);
        };
        
        function populateStyles() {
            var i, availableStyles, selectionList;
            selectionList = [];
            availableStyles = editorSession.getAvailableParagraphStyles();
            
            for (i = 0; i < availableStyles.length; i += 1) {
                selectionList.push({
                    label: availableStyles[i].displayName,
                    value: availableStyles[i].name
                });
            }

            select.removeOption(select.getOptions());
            select.addOption(selectionList);
        }

        function init(cb) {
            require(["dijit/form/Select"], function (Select) {
                var stylens = "urn:oasis:names:tc:opendocument:xmlns:style:1.0";
                 
                select = new Select({
                    name: 'ParagraphStyles',
                    maxHeight: 200,
                    style: {
                        width: '100px'
                    }
                });

                populateStyles();
                
                editorSession.subscribe('styleCreated', function (newStyleName) {
                    var newStyleElement = editorSession.getParagraphStyleElement(newStyleName);
                    select.addOption({
                        label: newStyleName,
                        value: newStyleElement.getAttributeNS(stylens, 'display-name')
                    });
                });

                editorSession.subscribe('styleDeleted', function (styleName) {
                    select.removeOption(styleName);
                    select.set('value', select.getOptions(0));
                });
                return cb();
            });
        }
    
        init(function () {
            return callback(self);
        });
    };
        
    return ParagraphStyles;
});
