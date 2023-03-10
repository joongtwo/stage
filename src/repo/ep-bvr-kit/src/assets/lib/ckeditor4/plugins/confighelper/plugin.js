/**
 * @file Configuration helper plugin for CKEditor
 * Copyright (C) 2012 Alfonso Martínez de Lizarrondo
 *
 */
(function() {
    'use strict';

    var supportsPlaceholder = ('placeholder' in document.createElement('textarea'));

    function dataIsEmpty(data) {
        if (!data)
            {return true;}

        if (data.length > 20)
            {return false;}

        var value = data.replace(/[\n|\t]*/g, '').toLowerCase();
        if (!value || value == '<br>' || value == '<div>&nbsp;<br></div>' || value == '<div><br></div>' || value == '<div>&nbsp;</div>' || value == '&nbsp;' || value == ' ' || value == '&nbsp;<br>' || value == ' <br>')
            {return true;}

        return false;
    }

    function addPlaceholder(ev) {
        var editor = ev.editor;
        var root = (editor.editable ? editor.editable() : (editor.mode == 'wysiwyg' ? editor.document && editor.document.getBody() : editor.textarea));
        var placeholder = ev.listenerData;
        if (!root)
            {return;}

        if (editor.mode == 'wysiwyg') {
            if (CKEDITOR.dialog._.currentTop)
                {return;}

            if (!root)
                {return;}

            if (dataIsEmpty(root.getHtml())) {
                root.setHtml(placeholder);
                root.addClass('placeholder');
                editor.resetDirty();
            }
        }
    }

    /**
     *@returns true if data is empty
     */
    function removePlaceholder(ev) {
        var editor = ev.editor;
        var root = (editor.editable ? editor.editable() : (editor.mode == 'wysiwyg' ? editor.document && editor.document.getBody() : editor.textarea));
        if (!root)
            {return;}

        if (editor.mode == 'wysiwyg') {
            if (!root.hasClass('placeholder'))
                {return;}

            root.removeClass('placeholder');
            if (CKEDITOR.dtd[root.getName()].div) {
                root.setHtml("<div><br></div>");
                editor.resetDirty();

            } else {
                root.setHtml(' ');
            }
        }
    }

    CKEDITOR.plugins.add('confighelper', {
        getPlaceholderCss: function() {
            return '.placeholder{ color: #999;font-style: italic; font-size: 12px }';
        },

        onLoad: function() {
            if (CKEDITOR.addCss)
                {CKEDITOR.addCss(this.getPlaceholderCss());}
        },

        init: function(editor) {

            editor.on('mode', function(ev) {
                ev.editor.focusManager.hasFocus = false;
            });

            var placeholder = editor.element.getAttribute('placeholder') || editor.config.placeholder;

            if (placeholder) {
                if (editor.addCss)
                    {editor.addCss(this.getPlaceholderCss());}

                editor.on('blur', addPlaceholder, null, placeholder);
                editor.on('mode', addPlaceholder, null, placeholder);
                editor.on('contentDom', addPlaceholder, null, placeholder);

                editor.on('focus', removePlaceholder);
                editor.on('key', removePlaceholder);
                editor.on('beforeModeUnload', removePlaceholder);
            }

        }
    });

})();
