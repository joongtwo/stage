/**
 * @fileOverview The "wiInsertImage" plugin.
 * This plugin is used to add symbols to work instructions editor.
 */
/*global
 CKEDITOR
 */
CKEDITOR.plugins.add('wiInsertImage', {
    init: function(editor) {
        editor.addCommand('wiInsertImage', {
            exec: function(editor) {

                var form = document.createElement("form");
                form.setAttribute("id", "fileUploadForm");

                var input = document.createElement("input");
                form.appendChild(input);


                input.setAttribute("type", "file");
                input.setAttribute("id", "fmsFile");
                input.setAttribute("name", "fmsFile");
                input.setAttribute("maxHeight", "40px");
                input.setAttribute("maxWidth", "auto");

                input.setAttribute("accept", "image/*");

                input.addEventListener('change', function(data) {
                    var file = this.files[0];
                    if (file) {

                        // create a reader instance
                        var reader = new FileReader();

                        reader.onload = function(event) {

                            var base64ImageUri = event.target.result;
                            // get the base64 image url String
                            var img = document.createElement('img');
                            img.onload = function() {
                                // insert image in editor
                                var imgHtml = CKEDITOR.dom.element.createFromHtml('<img style=max-height:40px;width:auto src=' + base64ImageUri + ' alt="Image not found!"></img>');
                                editor.insertElement(imgHtml);
                            };
                            img.src = event.target.result;


                        };

                        // read the data from image as url
                        reader.readAsDataURL(file);
                    }

                }, false);

                input.click();
            }
        });

        editor.on('selectionChange', function(evt) {
            var myCommand = this.getCommand('wiInsertImage');
            if (myCommand) {
                var ranges = editor.getSelection().getRanges();
                if (ranges && ranges.length > 0 && !ranges[0].checkReadOnly()) {
                    myCommand.enable();
                } else {
                    myCommand.disable();
                }
            }
        });

        editor.ui.addButton('wiInsertImage', {
            label: 'Insert Icon',
            command: 'wiInsertImage',
            toolbar: 'editing',
            icon: editor.config.baseURL + "/image/cmdWIAddSymbol16.svg"
        });
    }
});

