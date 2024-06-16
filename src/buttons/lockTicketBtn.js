import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import ticketSchema from "../schemas/ticketSchema.js";
import ticketSetupSchema from "../schemas/ticketSetupSchema.js";

export default {
  customId: "lockTicketBtn",
  userPermissions: [],
  botPermissions: [],
  run: async (client, interaction) => {
    try {
      const { channel, guild, member } = interaction;

      await interaction.deferReply({ ephemeral: true });

      // Get the ticket from the database
      const ticket = await ticketSchema.findOne({ ticketChannelID: channel.id });
      if (!ticket) {
        console.error('Ticket not found in database for channel ID:', channel.id);
        return await interaction.editReply({
          content: "Ticket not found.",
          ephemeral: true,
        });
      }

      // Get the ticket setup configuration to check for staff role
      const ticketSetup = await ticketSetupSchema.findOne({ guildID: guild.id });
      if (!ticketSetup) {
        console.error('Ticket setup not found for guild ID:', guild.id);
        return await interaction.editReply({
          content: "Ticket system is not configured properly.",
          ephemeral: true,
        });
      }

      const staffRole = guild.roles.cache.get(ticketSetup.staffRoleID);
      if (!staffRole) {
        console.error('Staff role not found in guild for role ID:', ticketSetup.staffRoleID);
        return await interaction.editReply({
          content: "Staff role not found. Please contact an administrator.",
          ephemeral: true,
        });
      }

      // Check if the member has the staff role
      if (!member.roles.cache.has(staffRole.id)) {
        return await interaction.editReply({
          content: "You do not have permission to lock or unlock tickets.",
          ephemeral: true,
        });
      }

      let ticketMember = guild.members.cache.get(ticket.ticketMemberID);
      if (!ticketMember) {
        // Manually fetch the member if not in cache
        try {
          ticketMember = await guild.members.fetch(ticket.ticketMemberID);
        } catch (fetchError) {
          console.error('Failed to fetch ticket member from API:', fetchError);
          return await interaction.editReply({
            content: "Ticket member not found in the guild.",
            ephemeral: true,
          });
        }
      }

      // Check current permissions to determine if the ticket is locked
      const currentPermissions = channel.permissionsFor(ticketMember);
      if (!currentPermissions) {
        console.error('Could not determine current permissions for ticket member ID:', ticket.ticketMemberID);
        return await interaction.editReply({
          content: "Could not determine the current permissions for the ticket member.",
          ephemeral: true,
        });
      }

      const isLocked = !currentPermissions.has(PermissionFlagsBits.SendMessages);

      if (isLocked) {
        // Unlock the ticket by updating permissions
        await channel.permissionOverwrites.edit(ticket.ticketMemberID, {
          SendMessages: true
        });

        await interaction.editReply({
          content: "This ticket has been unlocked.",
          ephemeral: true,
        });

        const unlockedEmbed = new EmbedBuilder()
          .setColor("Green")
          .setTitle("Ticket Unlocked")
          .setDescription(`This ticket has been unlocked by ${member.user.tag}.`);

        await channel.send({ embeds: [unlockedEmbed] });
      } else {
        // Lock the ticket by updating permissions
        await channel.permissionOverwrites.edit(ticket.ticketMemberID, {
          SendMessages: false
        });

        await interaction.editReply({
          content: "This ticket has been locked.",
          ephemeral: true,
        });

        const lockedEmbed = new EmbedBuilder()
          .setColor("Orange")
          .setTitle("Ticket Locked")
          .setDescription(`This ticket has been locked by ${member.user.tag}.`);

        await channel.send({ embeds: [lockedEmbed] });
      }
    } catch (err) {
      console.error('Error toggling ticket lock:', err);
      await interaction.editReply({
        content: 'There was an error toggling the ticket lock. Please try again later.',
        ephemeral: true,
      });
    }
  }
};
