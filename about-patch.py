from pathlib import Path
p=Path('index.html')
s=p.read_text()
s=s.replace('<div class="tabs"><button id="plantsBtn" class="tab active">Plants</button>','<div class="tabs"><button id="aboutBtn" class="tab active">About</button><button id="plantsBtn" class="tab">Plants</button>',1)
p.write_text(s)
