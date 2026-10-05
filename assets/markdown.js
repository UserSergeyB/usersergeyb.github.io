(function () {
  function inline(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  }

  function tableRow(line) {
    var cells = [];
    var cell = "";
    var backslashes = 0;
    var hasPipes = false;

    line.trim().split("").forEach(function (character) {
      if (character === "|" && backslashes % 2 === 0) {
        cells.push(cell.trim());
        cell = "";
        hasPipes = true;
      } else {
        cell += character;
      }
      backslashes = character === "\\" ? backslashes + 1 : 0;
    });
    cells.push(cell.trim());

    if (hasPipes && cells[0] === "") {
      cells.shift();
    }
    if (hasPipes && cells[cells.length - 1] === "") {
      cells.pop();
    }

    return { cells: cells, hasPipes: hasPipes };
  }

  function tableCell(text, tag, alignment) {
    var attributes = tag === "th" ? ' scope="col"' : "";
    if (alignment) {
      attributes += ' style="text-align: ' + alignment + '"';
    }
    return "<" + tag + attributes + ">" + inline(text.replace(/\\\|/g, "|")) + "</" + tag + ">";
  }

  function render(markdown) {
    var lines = markdown.trim().split(/\r?\n/);
    var html = [];
    var inList = false;

    for (var index = 0; index < lines.length; index += 1) {
      var text = lines[index].trim();

      if (!text) {
        if (inList) {
          html.push("</ul>");
          inList = false;
        }
        continue;
      }

      var header = tableRow(text);
      var separators = index + 1 < lines.length ? tableRow(lines[index + 1]).cells : [];
      if (!/^(#{1,6} |- )/.test(text) && header.hasPipes && header.cells.length > 0 && header.cells.length === separators.length &&
          separators.every(function (cell) { return /^:?-+:?$/.test(cell); })) {
        if (inList) {
          html.push("</ul>");
          inList = false;
        }

        var alignments = separators.map(function (cell) {
          if (cell.charAt(cell.length - 1) === ":") {
            return cell.charAt(0) === ":" ? "center" : "right";
          }
          return cell.charAt(0) === ":" ? "left" : "";
        });
        html.push('<div class="markdown-table"><table><thead><tr>');
        header.cells.forEach(function (cell, column) {
          html.push(tableCell(cell, "th", alignments[column]));
        });
        html.push("</tr></thead><tbody>");
        index += 1;

        while (index + 1 < lines.length) {
          var nextLine = lines[index + 1].trim();
          var row = tableRow(nextLine);
          if (!row.hasPipes || /^(#{1,6} |- )/.test(nextLine)) {
            break;
          }
          html.push("<tr>");
          header.cells.forEach(function (cell, column) {
            html.push(tableCell(row.cells[column] || "", "td", alignments[column]));
          });
          html.push("</tr>");
          index += 1;
        }
        html.push("</tbody></table></div>");
        continue;
      }

      if (text.indexOf("### ") === 0) {
        if (inList) {
          html.push("</ul>");
          inList = false;
        }
        html.push("<h3>" + inline(text.slice(4)) + "</h3>");
        continue;
      }

      if (text.indexOf("## ") === 0) {
        if (inList) {
          html.push("</ul>");
          inList = false;
        }
        html.push("<h2>" + inline(text.slice(3)) + "</h2>");
        continue;
      }

      if (text.indexOf("- ") === 0) {
        if (!inList) {
          html.push("<ul>");
          inList = true;
        }
        html.push("<li>" + inline(text.slice(2)) + "</li>");
        continue;
      }

      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push("<p>" + inline(text) + "</p>");
    }

    if (inList) {
      html.push("</ul>");
    }

    return html.join("");
  }

  function renderNode(node, markdown) {
    node.innerHTML = render(markdown);
  }

  function getFallbackLocale() {
    return (document.documentElement.getAttribute("lang") || "en").toLowerCase().split("-")[0] || "en";
  }

  function getFailedText(node, messages) {
    if (messages && messages.legal && messages.legal.failed) {
      return messages.legal.failed;
    }

    return node.textContent.trim() || "Failed to load data.";
  }

  function ensureMarkdownSources(locale) {
    document.querySelectorAll("[data-markdown-key]").forEach(function (node) {
      if (node.getAttribute("data-markdown-src")) {
        return;
      }

      node.setAttribute(
        "data-markdown-src",
        node.getAttribute("data-markdown-key") + "." + (locale || getFallbackLocale()) + ".md"
      );
    });
  }

  document.querySelectorAll("[data-markdown]").forEach(function (node) {
    renderNode(node, node.textContent);
  });

  function loadMarkdownDocuments(messages, locale, force) {
    ensureMarkdownSources(locale);

    document.querySelectorAll("[data-markdown-src]").forEach(function (node) {
      var source = node.getAttribute("data-markdown-src");
      var failedText = getFailedText(node, messages);

      if (!force && node.getAttribute("data-markdown-loaded-src") === source) {
        return;
      }

      fetch(source)
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Could not load " + source);
          }
          return response.text();
        })
        .then(function (markdown) {
          if (node.getAttribute("data-markdown-src") !== source) {
            return;
          }

          node.setAttribute("data-markdown-loaded-src", source);
          renderNode(node, markdown);
        })
        .catch(function () {
          node.removeAttribute("data-markdown-loaded-src");
          node.innerHTML = "<p>" + inline(failedText) + "</p>";
        });
    });
  }

  window.addEventListener("i18n:ready", function (event) {
    var detail = event.detail || {};
    loadMarkdownDocuments(detail.messages, detail.locale, true);
  });

  loadMarkdownDocuments({});
}());
