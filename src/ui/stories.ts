export interface Story {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  echo: string;
}

export const STORIES: Record<string, Story> = {
  xitai: {
    id: 'xitai',
    title: '晋剧 · 山西梆子',
    subtitle: '中路梆子 · 首批国家级非物质文化遗产',
    content:
      '晋剧源于蒲州梆子，清中叶沿汾河北上流入晋中，与祁太秧歌、汾孝秧歌等乡土声腔相融，逐渐形成婉转与激越并存的中路梆子。其唱腔高亢时如太行风起，低回处似汾水绕村，板式变化繁复，乱弹、腔儿、曲子各有章法。戏台上的绝活更令人称绝：帽翅功单翅轻颤而全身不动，翎子功掏翎、耍翎、衔翎皆成文章，水袖翻飞间悲欢尽现。晋商鼎盛之时，班社随商路遍走口外，梆子声远播塞上。二〇〇六年，晋剧列入首批国家级非物质文化遗产名录。一方古戏台，千年晋韵长——票面上的这座戏台，至今仍在城乡庙会间开锣。',
    echo: '一方古戏台 · 千年晋韵长',
  },
  yueqin: {
    id: 'yueqin',
    title: '晋胡 · 文场四大件',
    subtitle: '呼胡领衔 · 晋剧文场之魂',
    content:
      '晋剧文场以晋胡领衔。晋胡又称呼胡，琴杆短、琴筒小，蒙以桐木薄板，音色亮中带沙、刚中含柔，托腔保调，如诉如说，最是贴近晋人说话的声气。与晋胡相配的，是二弦、三弦、四弦，合称「文场四大件」：二弦清越，三弦浑厚，四弦绵密，四器相和，如众星捧月般衬着演员的唱腔起落。旧时戏班里有「七分场面三分唱」的说法，一出戏的气韵，一半系于琴师弓弦之间。月琴之音清圆如珠，亦常与文场相和，为梆子声腔添一分温润。票面所绘正是此般光景——晋胡声声，古调悠长。',
    echo: '晋胡声声 · 古调悠长',
  },
  kuaiban: {
    id: 'kuaiban',
    title: '太原莲花落 · 快板',
    subtitle: '竹板击节 · 一人一板一台戏',
    content:
      '莲花落源于唐宋时期的民间说唱，清末流入太原后与本地方言相融，演变为独具晋味的太原莲花落。艺人手执竹板，以击节为骨、方言为肉，一人一板便是一台戏：大板重击如惊堂，小板密点似骤雨，说表之间插科打诨，街巷见闻、世态人情皆入唱词。其词俗中见雅，其韵拙里藏巧，最接地气，也最能逗人会心一笑。昔日太原街头巷尾、茶馆庙会，竹板一响，听客便围拢过来。如今太原莲花落已列入国家级非物质文化遗产名录，老艺人传徒授艺，新段子仍说着今日城中事。票面那对朱红快板，敲的正是一口地道晋味。',
    echo: '竹板一响 · 地道晋味',
  },
};

export class ScrollPanel {
  private readonly layer: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly mask: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly subtitleEl: HTMLElement;
  private readonly contentEl: HTMLElement;
  private readonly echoEl: HTMLElement;
  private open = false;
  private closing = false;

  constructor(private readonly onOpenChange?: (open: boolean) => void) {
    this.layer = document.getElementById('scroll-layer')!;
    this.panel = document.getElementById('scroll-panel')!;
    this.mask = document.getElementById('scroll-mask')!;
    this.titleEl = document.getElementById('scroll-title')!;
    this.subtitleEl = document.getElementById('scroll-subtitle')!;
    this.contentEl = document.getElementById('scroll-content')!;
    this.echoEl = document.getElementById('scroll-echo')!;

    this.mask.addEventListener('click', () => this.close());
    document.getElementById('scroll-close')!.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });
  }

  get isOpen() {
    return this.open;
  }

  show(story: Story) {
    if (this.closing) return;
    this.titleEl.textContent = story.title;
    this.subtitleEl.textContent = story.subtitle;
    this.contentEl.textContent = story.content;
    this.echoEl.textContent = `—— ${story.echo} ——`;
    this.layer.classList.remove('hidden');
    this.panel.classList.remove('closing');
    // 重新触发展开动画
    this.panel.style.animation = 'none';
    void this.panel.offsetWidth;
    this.panel.style.animation = '';
    this.open = true;
    this.onOpenChange?.(true);
  }

  close() {
    if (!this.open || this.closing) return;
    this.closing = true;
    this.panel.classList.add('closing');
    this.panel.addEventListener(
      'animationend',
      () => {
        this.layer.classList.add('hidden');
        this.panel.classList.remove('closing');
        this.closing = false;
        this.open = false;
        this.onOpenChange?.(false);
      },
      { once: true },
    );
  }
}
