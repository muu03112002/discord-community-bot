const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, EmbedBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ボットのインテント（権限）設定
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// 設定ファイルの保存先
const configFolderPath = path.join(__dirname, 'config');
if (!fs.existsSync(configFolderPath)) {
  fs.mkdirSync(configFolderPath, { recursive: true });
}

// ロール設定の保存・読み込み
const getRoleConfigPath = (guildId) => path.join(configFolderPath, `${guildId}_roles.json`);

const saveRoleConfig = (guildId, config) => {
  fs.writeFileSync(getRoleConfigPath(guildId), JSON.stringify(config, null, 2));
};

const loadRoleConfig = (guildId) => {
  const filePath = getRoleConfigPath(guildId);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return { roles: [] };
};

// ボットの準備完了時のイベント
client.once('ready', () => {
  console.log(`準備完了: ${client.user.tag}でログインしました`);
});

// メッセージ受信時のイベント処理
client.on('messageCreate', async (message) => {
  // botのメッセージは無視
  if (message.author.bot) return;

  // 管理者権限チェック（コマンド実行者が管理者であることを確認）
  const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);

  // setupコマンド処理
  if (message.content.startsWith('!setup') && isAdmin) {
    const args = message.content.split(' ').slice(1);
    
    // ロール設定コマンド
    if (args[0] === 'role') {
      // !setup role <ボタンテキスト> <ロールID>
      if (args.length >= 3) {
        const buttonText = args[1];
        const roleId = args[2];
        
        // ロールが存在するか確認
        const role = message.guild.roles.cache.get(roleId);
        if (!role) {
          return message.reply('指定されたロールが見つかりません。正しいロールIDを指定してください。');
        }
        
        // 設定を保存
        const config = loadRoleConfig(message.guild.id);
        const existingRoleIndex = config.roles.findIndex(r => r.buttonText === buttonText);
        
        if (existingRoleIndex !== -1) {
          config.roles[existingRoleIndex].roleId = roleId;
        } else {
          config.roles.push({ buttonText, roleId });
        }
        
        saveRoleConfig(message.guild.id, config);
        return message.reply(`ボタン「${buttonText}」にロール「${role.name}」を設定しました。`);
      } else {
        return message.reply('使用方法: !setup role <ボタンテキスト> <ロールID>');
      }
    }
    
    // メインのセットアップメニュー
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_phone_verification')
          .setLabel('電話番号認証システム')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('setup_role_selection')
          .setLabel('ロール選択システム')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('setup_message_sender')
          .setLabel('メッセージ送信システム')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('setup_voice_channel')
          .setLabel('ボイスチャンネル作成システム')
          .setStyle(ButtonStyle.Danger)
      );

    await message.reply({ content: 'セットアップするシステムを選択してください：', components: [row] });
  }
});

// ボタンクリックイベント処理
client.on('interactionCreate', async (interaction) => {
  // ボタンクリック以外は無視
  if (!interaction.isButton()) return;
  
  const { customId, guild, channel, member } = interaction;
  
  // 管理者権限チェック（セットアップコマンド関連）
  const isAdmin = member && member.permissions.has(PermissionsBitField.Flags.Administrator);
  
  // セットアップボタン処理
  if (customId.startsWith('setup_') && isAdmin) {
    await interaction.deferReply({ ephemeral: true });
    
    // 電話番号認証システム
    if (customId === 'setup_phone_verification') {
      const embed = new EmbedBuilder()
        .setTitle('🔒 電話番号認証ガイド 🔒')
        .setDescription('ようこそ。\n本サーバーでは、安全性を確保するために電話番号認証をお願いしています。以下の手順に従って認証を行ってください。')
        .addFields(
          { name: '⚠️ 注意', value: '* 電話番号認証はサーバーの安全性を高めるために必須です。\n* 一度認証を行うと、今後は電話番号を変更しない限り再認証の必要はありません。' },
          { name: '', value: 'ご不明点があれば、運営までお知らせください。' }
        )
        .setColor('#0099ff');
      
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('verify_phone')
            .setLabel('電話番号で認証する')
            .setStyle(ButtonStyle.Primary)
        );
      
      await channel.send({ embeds: [embed], components: [row] });
      await interaction.editReply({ content: '電話番号認証システムをセットアップしました。', ephemeral: true });
    }
    
    // ロール選択システム
    else if (customId === 'setup_role_selection') {
      const embed = new EmbedBuilder()
        .setTitle('🎮 ロール選択 🎮')
        .setDescription('本サーバー内では、プレイヤーに適したロール（役職）を選んでいただく必要があります。以下の手順に従って、希望するロールを選択してください。')
        .addFields(
          { name: '1. ロール選択', value: '下記のボタンから自分に合ったロールを選んでください。選択したロールに応じて、サーバー内でのアクセス権や役割が決まります。複数選択可能です。' },
          { name: '2. 変更・解除', value: 'ロールは後から変更することも可能です。解除したい場合はロールのボタンを再度押してください。' },
          { name: '', value: 'ご不明な点があれば運営にお知らせください。' }
        )
        .setColor('#00ff00');
      
      // 保存されているロール設定を読み込む
      const config = loadRoleConfig(guild.id);
      
      // ロールボタンを作成
      const rows = [];
      const buttonsPerRow = 5;
      
      for (let i = 0; i < config.roles.length; i += buttonsPerRow) {
        const row = new ActionRowBuilder();
        
        for (let j = 0; j < buttonsPerRow && i + j < config.roles.length; j++) {
          const roleConfig = config.roles[i + j];
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`role_${roleConfig.roleId}`)
              .setLabel(roleConfig.buttonText)
              .setStyle(ButtonStyle.Secondary)
          );
        }
        
        rows.push(row);
      }
      
      // 設定されたロールがない場合
      if (rows.length === 0) {
        await interaction.editReply({
          content: 'ロールが設定されていません。`!setup role <ボタンテキスト> <ロールID>`でロールを設定してください。',
          ephemeral: true
        });
        return;
      }
      
      await channel.send({ embeds: [embed], components: rows });
      await interaction.editReply({ content: 'ロール選択システムをセットアップしました。', ephemeral: true });
    }
    
    // メッセージ送信システム
    else if (customId === 'setup_message_sender') {
      const modal = {
        title: 'メッセージ送信システム',
        custom_id: 'message_sender_modal',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'message_content',
                label: '送信したいメッセージ',
                style: 2,
                min_length: 1,
                max_length: 2000,
                placeholder: 'ここにメッセージを入力してください',
                required: true
              }
            ]
          }
        ]
      };
      
      await interaction.showModal(modal);
    }
    
    // ボイスチャンネル作成システム
    else if (customId === 'setup_voice_channel') {
      const embed = new EmbedBuilder()
        .setTitle('🔊 ボイスチャンネル作成システム 🔊')
        .setDescription('以下のボタンを押して、一時的なボイスチャンネルを作成できます。')
        .addFields(
          { name: '使い方', value: '1. 「ボイスチャンネルを作成」ボタンをクリックします\n2. チャンネル名を入力します\n3. 作成されたチャンネルに10秒以内に参加してください\n4. チャンネル内の全メンバーが退出すると、10秒後に自動的に削除されます' }
        )
        .setColor('#ff0000');
      
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_voice_channel')
            .setLabel('ボイスチャンネルを作成')
            .setStyle(ButtonStyle.Success)
        );
      
      await channel.send({ embeds: [embed], components: [row] });
      await interaction.editReply({ content: 'ボイスチャンネル作成システムをセットアップしました。', ephemeral: true });
    }
  }
  
  // 電話番号認証ボタン
  else if (customId === 'verify_phone') {
    await interaction.reply({
      content: 'Discordの電話番号認証ガイドに従って認証を行ってください：\n1. Discordの設定を開きます\n2. アカウント設定から「電話番号」を選択します\n3. 画面の指示に従って電話番号を登録します\n4. 認証コードを入力して認証完了\n\n※このプロセスはDiscordの公式機能を使用します。botは電話番号を収集しません。',
      ephemeral: true
    });
  }
  
  // ロール選択ボタン
  else if (customId.startsWith('role_')) {
    await interaction.deferReply({ ephemeral: true });
    
    const roleId = customId.replace('role_', '');
    const role = guild.roles.cache.get(roleId);
    
    if (!role) {
      await interaction.editReply({ content: '指定されたロールが見つかりません。管理者に連絡してください。', ephemeral: true });
      return;
    }
    
    // ロールの付与・解除を切り替え
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      await interaction.editReply({ content: `ロール「${role.name}」を解除しました。`, ephemeral: true });
    } else {
      await member.roles.add(roleId);
      await interaction.editReply({ content: `ロール「${role.name}」を付与しました。`, ephemeral: true });
    }
  }
  
  // ボイスチャンネル作成ボタン
  else if (customId === 'create_voice_channel') {
    const modal = {
      title: 'ボイスチャンネル作成',
      custom_id: 'voice_channel_modal',
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'channel_name',
              label: 'チャンネル名',
              style: 1,
              min_length: 1,
              max_length: 100,
              placeholder: '例: ゲーム部屋',
              required: true
            }
          ]
        }
      ]
    };
    
    await interaction.showModal(modal);
  }
});

// モーダル送信イベント処理
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  
  const { customId, guild, channel, member } = interaction;
  
  // ボイスチャンネル作成モーダル
  if (customId === 'voice_channel_modal') {
    await interaction.deferReply({ ephemeral: true });
    
    const channelName = interaction.fields.getTextInputValue('channel_name');
    
    try {
      // カテゴリーを取得（または作成）
      let category = guild.channels.cache.find(c => c.name === '一時的なボイスチャンネル' && c.type === ChannelType.GuildCategory);
      
      if (!category) {
        category = await guild.channels.create({
          name: '一時的なボイスチャンネル',
          type: ChannelType.GuildCategory
        });
      }
      
      // ボイスチャンネル作成
      const voiceChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: category.id
      });
      
      await interaction.editReply({ 
        content: `ボイスチャンネル「${channelName}」を作成しました。10秒以内に参加してください。`,
        ephemeral: true 
      });
      
      // 10秒後にチェック
      setTimeout(async () => {
        try {
          // チャンネルが存在するか確認
          const updatedChannel = await guild.channels.fetch(voiceChannel.id).catch(() => null);
          if (!updatedChannel) return;
          
          // メンバーがいなければ削除
          if (updatedChannel.members.size === 0) {
            await updatedChannel.delete('自動削除: 10秒以内に誰も参加しませんでした');
          }
        } catch (error) {
          console.error('チャンネル確認中にエラーが発生しました:', error);
        }
      }, 10000);
      
    } catch (error) {
      console.error('ボイスチャンネル作成中にエラーが発生しました:', error);
      await interaction.editReply({ 
        content: 'ボイスチャンネルの作成中にエラーが発生しました。権限を確認してください。',
        ephemeral: true 
      });
    }
  }
  
  // メッセージ送信モーダル
  else if (customId === 'message_sender_modal') {
    await interaction.deferReply({ ephemeral: true });
    
    const messageContent = interaction.fields.getTextInputValue('message_content');
    
    try {
      await channel.send({ content: messageContent });
      await interaction.editReply({ content: 'メッセージを送信しました。', ephemeral: true });
    } catch (error) {
      console.error('メッセージ送信中にエラーが発生しました:', error);
      await interaction.editReply({ 
        content: 'メッセージの送信中にエラーが発生しました。',
        ephemeral: true 
      });
    }
  }
});

// ボイスチャンネルの状態変更イベント
client.on('voiceStateUpdate', async (oldState, newState) => {
  // ユーザーがボイスチャンネルから退出した場合
  if (oldState.channelId && !newState.channelId) {
    const channel = oldState.channel;
    
    // チャンネルが存在し、カテゴリーが「一時的なボイスチャンネル」である場合
    if (channel && channel.parent && channel.parent.name === '一時的なボイスチャンネル') {
      // チャンネル内のメンバーがいないかチェック
      if (channel.members.size === 0) {
        // 10秒待ってから再度確認
        setTimeout(async () => {
          try {
            // チャンネルが存在するか確認
            const updatedChannel = await oldState.guild.channels.fetch(channel.id).catch(() => null);
            if (!updatedChannel) return;
            
            // メンバーがいなければ削除
            if (updatedChannel.members.size === 0) {
              await updatedChannel.delete('自動削除: 全メンバーが退出してから10秒経過');
            }
          } catch (error) {
            console.error('チャンネル削除中にエラーが発生しました:', error);
          }
        }, 10000);
      }
    }
  }
});

// エラーハンドリング
client.on('error', (error) => {
  console.error('エラーが発生しました:', error);
});

// ボットにログインする
client.login(process.env.DISCORD_TOKEN);

// ReadableStreamのポリフィルチェック（念のため）
if (typeof ReadableStream === 'undefined') {
  console.log("ReadableStream is not defined, using polyfill.js");
}
