  var excerptRows = 7;
  var input;
  var separator;
  var url;

  function doJSON() {
    // just in case

    $(".drop").hide();

    // get input JSON, try to parse it
    var newInput = $(".json textarea").val();
    var newSeparator = getSeparator();
    if (newInput == input && newSeparator == separator) return;

    input = newInput;
    if (!input) {
      // wipe the rendered version too
      $(".json code").text("");
      return;
    }

    separator = newSeparator;
    var json = jsonFrom(input);

    // if succeeded, prettify and highlight it
    // highlight shows when textarea loses focus
    if (json) {
      // Reset any error message from previous failed parses.
      $("div.error").hide();
      $("div.warning").show();

      var pretty = JSON.stringify(json, undefined, 2);
      $(".json code").text(pretty);
      if (pretty.length < (50 * 1024))
        hljs.highlightBlock($(".json code").get(0));

      // convert to CSV, make available
      doCSV(json);
    } else {
      // Show error.
      $("div.warning").hide();
      $("div.error").show();
      $(".json code").text("");
    }

    return true;
  }

  function renderAll(e) {
    var json = jsonFrom(input);
    var inArray = arrayFrom(json);
    var outArray = [];
    for (var row in inArray)
      outArray[outArray.length] = parse_object(inArray[row]);
    renderCSV(outArray);
    $(".show-render-all").hide();
    return false;
  }

  // show rendered JSON
  function showJSON(rendered) {
    console.log("ordered to show JSON: " + rendered);
    if (rendered) {
      if ($(".json code").text()) {
        console.log("there's code to show, showing...");
        $(".json .rendered").show();
        $(".json .editing").hide();
      }
    } else {
      $(".json .rendered").hide();
      $(".json .editing").show().focus();
    }
  }

  function showCSV(rendered) {
    if (rendered) {
      if ($(".csv table").text()) {
        $(".csv .rendered").show();
        $(".csv .editing").hide();
      }
    } else {
      $(".csv .rendered").hide();
      $(".csv .editing").show().focus();
    }
  }

  function getSeparator() {
    var separator = $(".json .separator select").val();

    switch (separator) {
      case "tab":
        return "\t";
        break;
      case "semicolon":
        return ';';
        break;
      case "comma":
      default:
        return ',';
        break;
    }
  }

  // takes an array of flat JSON objects, converts them to arrays
  // renders them into a small table as an example
  function renderCSV(objects) {
    var rows = $.csv.fromObjects(objects, {justArrays: true});
    if (rows.length < 1) return;

    // find CSV table
    var table = $(".csv table")[0];
    $(table).text("");

    // render header row
    var thead = document.createElement("thead");
    var tr = document.createElement("tr");
    var header = rows[0];
    for (field in header) {
      var th = document.createElement("th");
      $(th).text(header[field])
      tr.appendChild(th);
    }
    thead.appendChild(tr);

    // render body of table
    var tbody = document.createElement("tbody");
    for (var i=1; i<rows.length; i++) {
      tr = document.createElement("tr");
      for (field in rows[i]) {
        var td = document.createElement("td");
        $(td)
          .text(rows[i][field])
          .attr("title", rows[i][field]);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    table.appendChild(thead);
    table.appendChild(tbody);
  }

  function doCSV(json) {
    // 1) find the primary array to iterate over
    // 2) for each item in that array, recursively flatten it into a tabular object
    // 3) turn that tabular object into a CSV row using jquery-csv
    var inArray = arrayFrom(json);

    var outArray = [];
    for (var row in inArray)
        outArray[outArray.length] = parse_object(inArray[row]);

    $("span.rows.count").text("" + outArray.length);

    var csv = $.csv.fromObjects(outArray, {separator: getSeparator()});
    // excerpt and render first few rows
    renderCSV(outArray.slice(0, excerptRows));
    showCSV(true);

    // if there's more we're not showing, add a link to show all
    if (outArray.length > excerptRows)
      $(".show-render-all").show();

    // show raw data if people really want it
    $(".csv textarea").val(csv);

    // download link to entire CSV as data
    // thanks to https://jsfiddle.net/terryyounghk/KPEGU/
    // and https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
    var uri = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    $(".csv a.download").attr("href", uri);
  }


  // Load any (now-deprecated) permalinks. We can't save them anymore,
  // but old links can still work.
  function loadPermalink() {
    var id = getParam("id");
    if (!id) return;

    $.get('https://api.github.com/gists/' + id,
      function(data, status, xhr) {
        console.log("Remaining this hour: " + xhr.getResponseHeader("X-RateLimit-Remaining"));

        var input = data.files["source.json"].content;
        $(".json textarea").val(input);
        doJSON();
        showJSON(true);
      }
    ).fail(function(xhr, status, errorThrown) {
      console.log("Error fetching anonymous gist!");
      console.log(xhr);
      console.log(status);
      console.log(errorThrown);
    });
  }

  $(function() {

   // $(".json textarea").blur(function() {showJSON(true);});
   // $(".json pre").click(function() {showJSON(false)});
    $(".json .separator select").change(function() {doJSON();});
    $(".csv textarea").blur(function() {showCSV(true);})
    $(".csv .raw").click(function() {
      showCSV(false);
      $(".csv textarea").focus().select();
      return false;
    })

    $(".render-all").click(renderAll);

    // if there's no CSV to download, don't download anything.
    // also, log an analytics event.
    $(".csv a.download").click(function() {
      var data = $(".csv textarea").val();
      if (data) {
        Events.download(data.length);
        return true;
      } else
        return false;
    });

    // transform the JSON whenever it's pasted/edited
    $(".json textarea")
      .on('mousemove', function() {
        // delay the showing so the paste is pasted by then
        setTimeout(function() {
          doJSON();
          $(".json textarea").blur();
        }, 0);
      })
      .keyup(doJSON); // harmless to repeat doJSON

    // go away
    $("body").click(function() {
      $(".drop").hide();
    });

    $(document)
      .on("dragenter", function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(".drop").show();
      })
      .on("dragover", function(e) {
        e.preventDefault();
        e.stopPropagation();
      })
      .on("dragend", function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(".drop").hide();
      })
      .on("drop", function(e) {
        $(".drop").hide();

        if (e.originalEvent.dataTransfer) {
          if (e.originalEvent.dataTransfer.files.length) {
            e.preventDefault();
            e.stopPropagation();

            var reader = new FileReader();

            reader.onload = function(ev) {
              console.log(ev.target.result);
              $(".json textarea").val(ev.target.result);

              setTimeout(function() {
                doJSON();
                $(".json textarea").blur();
              }, 1);
            }

            reader.readAsText(e.originalEvent.dataTransfer.files[0]);
          }
        }
      });

    // highlight CSV on click
    $(".csv textarea").click(function() {$(this).focus().select();});

    // Support (now-deprecated) anonymous gist-backed permalinks.
    loadPermalink();
  });


//URL Fetch API
  function prabhat() {
//var url = 'https://open-to-cors.s3.amazonaws.com/users.json';
var url = document.getElementById("url").value;
fetch(url)
.then(res => res.json())
.then((out) => {
  console.log('Checkout this JSON! ', out);
  $("#textarea").append(JSON.stringify(out,null,'\t'));
})
.catch(err => { throw err });
}