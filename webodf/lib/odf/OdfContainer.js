/*global runtime odf core DOMParser document*/
runtime.loadClass("core.Base64");
runtime.loadClass("core.Zip");
/**
 * This is a pure javascript implementation of the first simple OdfKit api.
 **/
odf.OdfContainer = (function () {
    var officens = "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
        nodeorder = ['meta', 'settings', 'scripts', 'font-face-decls', 'styles',
            'automatic-styles', 'master-styles', 'body'],
        base64 = new core.Base64();
    /**
     * @param {?Node} node
     * @param {!string} ns
     * @param {!string} name
     * @return {?Node}
     */
    function getDirectChild(node, ns, name) {
        node = (node) ? node.firstChild : null;
        while (node) {
            if (node.localName === name && node.namespaceURI === ns) {
                return node;
            }
            node = node.nextSibling;
        }
    }
    /**
     * Return the position the node should get according to the ODF flat format.
     * @param {!Node} child
     * @return {!number}
     */
    function getNodePosition(child) {
        var childpos = 0, i, l = nodeorder.length;
        for (i = 0; i < l; i += 1) {
            if (child.namespaceURI === officens &&
                    child.localName === nodeorder[i]) {
                return i;
            }
        }
        return -1;
    }
    /**
     * Put the element at the right position in the parent.
     * The right order is given by the value returned from getNodePosition.
     * @param {!Node} node
     * @param {?Node} child
     * @return {undefined}
     */
    function setChild(node, child) {
        if (!child) {
            return;
        }
        var childpos = getNodePosition(child),
            pos,
            c = node.firstChild;
        if (childpos === -1) {
            return;
        }
        while (c) {
            pos = getNodePosition(c);
            if (pos !== -1 && pos > childpos) {
                break;
            }
            c = c.nextSibling;
        }
        node.insertBefore(child, c);
    }
    /**
     * A DOM element that is part of and ODF part of a DOM.
     * @constructor
     * @extends {Element}
     */
    function ODFElement() {
    }
    /**
     * The root element of an ODF document.
     * @constructor
     * @extends {ODFElement}
     */
    function ODFDocumentElement(odfcontainer) {
        this.OdfContainer = odfcontainer;
    }
    ODFDocumentElement.prototype = new ODFElement();
    ODFDocumentElement.prototype.constructor = ODFDocumentElement;
    ODFDocumentElement.namespaceURI = officens;
    ODFDocumentElement.localName = 'document';
    // private constructor
    /**
     * @constructor
     * @param {!string} name
     * @param {!OdfContainer} container
     * @param {!core.Zip} zip
     */
    function OdfPart(name, container, zip) {
        var self = this,
            privatedata;

        // declare public variables
        this.size = 0;
        this.type = null;
        this.name = name;
        this.container = container;
        this.url = null;
        this.document = null;
        this.onreadystatechange = null;
        this.onchange = null;
        this.EMPTY = 0;
        this.LOADING = 1;
        this.DONE = 2;
        this.state = this.EMPTY;

        // private functions
        function createUrl() {
            self.url = null;
            if (!privatedata) {
                return;
            }
            if (privatedata.substr(1, 3) === "PNG") {
                self.url = 'data:image/png;base64,';
            } else {
                self.url = 'data:;base64,';
            }
            // to avoid exceptions, base64 encoding is done in chunks
            // it would make sense to move this to base64.toBase64
            var chunksize = 45000, // must be multiple of 3 and less than 50000
                i = 0;
            while (i < privatedata.length) {
                self.url += base64.toBase64(privatedata.substr(i, chunksize));
                i += chunksize;
            }
        }
        // public functions
        this.load = function () {
            zip.load(name, function (err, data) {
                privatedata = data;
                createUrl();
                if (self.onchange) {
                    self.onchange(self);
                }
                if (self.onstatereadychange) {
                    self.onstatereadychange(self);
                }
            });
        };
        this.abort = function () {
            // TODO
        };
    }
    OdfPart.prototype.load = function () {
    };
    OdfPart.prototype.getUrl = function () {
        if (this.data) {
            return 'data:;base64,' + base64.toBase64(this.data);
        }
        return null;
    };
    /**
     * @constructor
     * @param {!OdfContainer} odfcontainer
     */
    function OdfPartList(odfcontainer) {
        var self = this;
        // declare public variables
        this.length = 0;
        this.item = function (index) {
        };
    }
    /**
     * @constructor
     * @param {!string} url
     */
    function OdfContainer(url) {
        var self = this,
            zip = null;

        // NOTE each instance of OdfContainer has a copy of the private functions
        // it would be better to have a class OdfContainerPrivate where the
        // private functions can be defined via OdfContainerPrivate.prototype
        // without exposing them

        // declare public variables
        this.onstatereadychange = null;
        this.onchange = null;
        this.state = null;
        this.rootElement = null;
        this.parts = null;

        /**
         * @param {!Element} element
         * @return {undefined}
         */
        function removeProcessingInstructions(element) {
            var n = element.firstChild, next, e;
            while (n) {
                next = n.nextSibling;
                if (n.nodeType === 1) { // ELEMENT
                    e = /**@type{!Element}*/(n);
                    removeProcessingInstructions(e);
                } else if (n.nodeType === 7) { // PROCESSING_INSTRUCTION_NODE
                    element.removeChild(n);
                }
                n = next;
            }
        }

        // private functions
        /**
         * @param {!Document} xmldoc
         * @return {!Node}
         */
        function importRootNode(xmldoc) {
            var doc = self.rootElement.ownerDocument,
                node;
            // remove all processing instructions
            // TODO: replace cursor processing instruction with an element
            removeProcessingInstructions(xmldoc.documentElement);
            try {
                node = doc.importNode(xmldoc.documentElement, true);
            } catch (e) {
            }
            return node;
        }
        function setState(state) {
            self.state = state;
            if (self.onchange) {
                self.onchange(self);
            }
            if (self.onstatereadychange) {
                self.onstatereadychange(self);
            }
        }
        /**
         * @param {!Document} xmldoc
         * @return {undefined}
         */
        function handleStylesXml(xmldoc) {
            var node = importRootNode(xmldoc),
                root = self.rootElement;
            if (!node || node.localName !== 'document-styles' ||
                    node.namespaceURI !== officens) {
                setState(OdfContainer.INVALID);
                return;
            }
            root.styles = getDirectChild(node, officens, 'styles');
            setChild(root, root.styles);
            root.automaticStyles = getDirectChild(node, officens, 'automatic-styles');
            setChild(root, root.automaticStyles);
            root.masterStyles = getDirectChild(node, officens, 'master-styles');
            setChild(root, root.masterStyles);
        }
        /**
         * @param {!Document} xmldoc
         * @return {undefined}
         */
        function handleContentXml(xmldoc) {
            var node = importRootNode(xmldoc),
                root,
                automaticStyles,
                c;
            if (!node || node.localName !== 'document-content' ||
                    node.namespaceURI !== officens) {
                setState(OdfContainer.INVALID);
                return;
            }
            root = self.rootElement;
            root.body = getDirectChild(node, officens, 'body');
            setChild(root, root.body);
            automaticStyles = getDirectChild(node, officens, 'automatic-styles');
            if (root.automaticStyles && automaticStyles) {
                c = automaticStyles.firstChild;
                while (c) {
                    root.automaticStyles.appendChild(c);
                    c = automaticStyles.firstChild; // works because node c moved
                }
            } else if (automaticStyles) {
                root.automaticStyles = automaticStyles;
                setChild(root, automaticStyles);
            }
        }
        /**
         * @param {!Document} xmldoc
         * @return {undefined}
         */
        function handleMetaXml(xmldoc) {
            var node = importRootNode(xmldoc),
                root;
            if (!node || node.localName !== 'document-meta' ||
                    node.namespaceURI !== officens) {
                return;
            }
            root = self.rootElement;
            root.meta = getDirectChild(node, officens, 'meta');
            setChild(root, root.meta);
        }
        /**
         * @param {!Document} xmldoc
         * @return {undefined}
         */
        function handleSettingsXml(xmldoc) {
            var node = importRootNode(xmldoc),
                root;
            if (!node || node.localName !== 'document-settings' ||
                    node.namespaceURI !== officens) {
                return;
            }
            root = self.rootElement;
            root.settings = getDirectChild(node, officens, 'settings');
            setChild(root, root.settings);
        }
        /**
         * @param {!string} filepath
         * @param {!function(?string,?Document)} callback
         * @return {undefined}
         */
        function getXmlNode(filepath, callback) {
            zip.load(filepath, function (err, xmldata) {
                if (err) {
                    callback(err, null);
                    return;
                }
                // assume the xml input data is utf8
                // this can be done better
                base64.convertUTF8StringToUTF16String(xmldata,
                        function (str, done) {
                    if (done) {
                        var parser = new DOMParser();
                        str = parser.parseFromString(str, "text/xml");
                        callback(null, str);
                    }
                    return true;
                });
            });
        }
        /**
         * @return {undefined}
         */
        function loadComponents() {
            // always load content.xml, meta.xml, styles.xml and settings.xml
            getXmlNode('styles.xml', function (err, xmldoc) {
                handleStylesXml(xmldoc);
                if (self.state === OdfContainer.INVALID) {
                    return;
                }
                getXmlNode('content.xml', function (err, xmldoc) {
                    handleContentXml(xmldoc);
                    if (self.state === OdfContainer.INVALID) {
                        return;
                    }
                    getXmlNode('meta.xml', function (err, xmldoc) {
                        handleMetaXml(xmldoc);
                        if (self.state === OdfContainer.INVALID) {
                            return;
                        }
                        getXmlNode('settings.xml', function (err, xmldoc) {
                            if (xmldoc) {
                                handleSettingsXml(xmldoc);
                            }
                            if (self.state !== OdfContainer.INVALID) {
                                setState(OdfContainer.DONE);
                            }
                        });                        
                    });                    
                });
            });
        }
        function createElement(Type) {
            var original = document.createElementNS(
                    Type.namespaceURI, Type.localName),
                method,
                iface = new Type();
            for (method in iface) {
                if (iface.hasOwnProperty(method)) {
                    original[method] = iface[method];
                }
            }
            return original;
        }
        // TODO: support single xml file serialization and different ODF
        // versions
        /**
         * @param {!string} filepath
         * @param {function(?string, ?string):undefined} callback
         * @return {undefined}
         */
        function load(filepath, callback) {
            zip.load(filepath, function (err, data) {
                if (self.onchange) {
                    self.onchange(self);
                }
                if (self.onstatereadychange) {
                    self.onstatereadychange(self);
                }
            });
        }
        // public functions
        /**
         * Open file and parse it. Return the Xml Node. Return the root node of
         * the file or null if this is not possible.
         * For 'content.xml', 'styles.xml', 'meta.xml', and 'settings.xml', the
         * elements 'document-content', 'document-styles', 'document-meta', or
         * 'document-settings' will be returned respectively.
         * @param {!string} partname
         * @return {!OdfPart}
         **/
        this.getPart = function (partname) {
            return new OdfPart(partname, self, zip);
        };

        // initialize public variables
        this.state = OdfContainer.LOADING;
        this.rootElement = createElement(ODFDocumentElement);
        this.parts = new OdfPartList(this);

        // initialize private variables
        zip = new core.Zip(url, function (err, zipobject) {
            zip = zipobject;
            if (err) {
                zip.error = err;
                setState(OdfContainer.INVALID);
            } else {
                loadComponents();
            }
        });
    }
    OdfContainer.EMPTY = 0;
    OdfContainer.LOADING = 1;
    OdfContainer.DONE = 2;
    OdfContainer.INVALID = 3;
    OdfContainer.SAVING = 4;
    OdfContainer.MODIFIED = 5;
    /**
     * @param {!string} url
     * @return {!OdfContainer}
     */
    OdfContainer.getContainer = function (url) {
        return new OdfContainer(url);
    };
    return OdfContainer;
}());
